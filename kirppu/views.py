from collections import namedtuple
import json
import re
import urllib

import barcode
from django.conf import settings
from django.contrib.auth import logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import (
    PermissionDenied,
    ValidationError,
)
import django.core.urlresolvers as url
from django.db.models import Sum
from django.db import transaction
from django.http.response import (
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseForbidden,
    HttpResponseRedirect,
)
from django.http import Http404
from django.shortcuts import (
    redirect,
    render,
    get_object_or_404,
)
from django.utils.http import is_safe_url
from django.utils.translation import ugettext as _
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .checkout_api import clerk_logout_fn
from . import ajax_util
from .forms import ItemRemoveForm
from .fields import ItemPriceField
from .models import (
    Box,
    Clerk,
    Item,
    Vendor,
    UserAdapter,
)
from .util import get_form
from .utils import (
    barcode_view,
    is_vendor_open,
    PixelWriter,
    require_setting,
    require_test,
    require_vendor_open,
)
from .templatetags.kirppu_tags import get_dataurl, KirppuBarcode


def index(request):
    return redirect("kirppu:vendor_view")


@login_required
@require_http_methods(["POST"])
@require_vendor_open
def item_add(request):
    vendor = Vendor.get_vendor(request.user)
    name = request.POST.get("name", u"").strip()
    price = request.POST.get("price")
    tag_type = request.POST.get("type", "short")
    suffix_str = request.POST.get("range", u"")
    itemtype = request.POST.get("itemtype", u"")
    adult = request.POST.get("adult", "no")

    if not itemtype:
        return HttpResponseBadRequest(_(u"Item must have a type."))

    try:
        price = ItemPriceField().clean(price)
    except ValidationError as error:
        return HttpResponseBadRequest(u' '.join(error.messages))

    def expand_suffixes(input_str):
        """
        Turn 'a b 1 3-4' to ['a', 'b', '1', '3', '4']

        :type input_str: str | unicode
        :rtype: list
        """
        words = input_str.split()
        result = []

        for word in words:
            # Handle the range syntax as a special case.
            match = re.match(r"(\d+)-(\d+)$", word)
            if match:
                # Turn '1-3' to ['1', '2', '3'] and so on
                left, right = map(int, match.groups())
                if abs(left - right) + 1 > 100:
                    return None
                if left > right:
                    left, right = right, left
                result.extend(map(unicode, range(left, right + 1)))
            else:
                result.append(word)

        return result

    suffixes = expand_suffixes(suffix_str)
    if suffixes is None:
        return HttpResponseBadRequest(_(u'Maximum of 100 items allowed by a single range statement.'))

    if not suffixes:
        # If there are no suffixes the name is added as is just once.
        # This is equivalent to adding empty string as suffix.
        suffixes.append(u"")

    item_cnt = Item.objects.filter(vendor=vendor).count()

    # Create the items and construct a response containing all the items that have been added.
    response = []
    max_items = settings.KIRPPU_MAX_ITEMS_PER_VENDOR
    for suffix in suffixes:
        if item_cnt >= max_items:
            error_msg = _(u"You have %(max_items)s items, which is the maximum. No more items can be registered.")
            return HttpResponseBadRequest(error_msg % {'max_items': max_items})
        item_cnt += 1

        suffixed_name = (name + u" " + suffix).strip()
        item = Item.new(
            name=suffixed_name,
            price=str(price),
            vendor=vendor,
            type=tag_type,
            state=Item.ADVERTISED,
            itemtype=itemtype,
            adult=adult
        )
        item_dict = {
            'vendor_id': vendor.id,
            'code': item.code,
            'barcode_dataurl': get_dataurl(item.code, 'png'),
            'name': item.name,
            'price': str(item.price_fmt).replace('.', ','),
            'type': item.type,
            'adult': item.adult
        }
        response.append(item_dict)

    return HttpResponse(json.dumps(response), 'application/json')


@login_required
@require_http_methods(["POST"])
def item_hide(request, code):
    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor)

    item.hidden = True
    item.save()

    return HttpResponse()


@login_required
@require_http_methods(['POST'])
def item_to_not_printed(request, code):
    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor, box__isnull=True)

    if settings.KIRPPU_COPY_ITEM_WHEN_UNPRINTED:
        # Create a duplicate of the item with a new code and hide the old item.
        # This way, even if the user forgets to attach the new tags, the old
        # printed tag is still in the system.
        if not is_vendor_open():
            return HttpResponseForbidden("Registration is closed")

        new_item = Item.new(
            name=item.name,
            price=item.price,
            vendor=item.vendor,
            type=item.type,
            state=Item.ADVERTISED,
            itemtype=item.itemtype,
            adult=item.adult
        )
        item.hidden = True
    else:
        item.printed = False
        new_item = item
    item.save()

    item_dict = {
        'vendor_id': new_item.vendor_id,
        'code': new_item.code,
        'barcode_dataurl': get_dataurl(item.code, 'png'),
        'name': new_item.name,
        'price': str(new_item.price).replace('.', ','),
        'type': new_item.type,
        'adult': new_item.adult,
    }

    return HttpResponse(json.dumps(item_dict), 'application/json')


@login_required
@require_http_methods(["POST"])
def item_to_printed(request, code):
    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor, box__isnull=True)

    item.printed = True
    item.save()

    return HttpResponse()


@login_required
@require_http_methods(["POST"])
@require_vendor_open
def item_update_price(request, code):
    try:
        price = ItemPriceField().clean(request.POST.get('value'))
    except ValidationError as error:
        return HttpResponseBadRequest(u' '.join(error.messages))

    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor, box__isnull=True)

    if item.is_locked():
        return HttpResponseBadRequest("Item has been brought to event. Price can't be changed.")

    item.price = str(price)
    item.save()

    return HttpResponse(str(price).replace(".", ","))


@login_required
@require_http_methods(["POST"])
@require_vendor_open
def item_update_name(request, code):
    name = request.POST.get("value", "no name")
    
    name = name[:80]

    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor)

    if item.is_locked():
        return HttpResponseBadRequest("Item has been brought to event. Name can't be changed.")

    item.name = name
    item.save()

    return HttpResponse(name)


@login_required
@require_http_methods(["POST"])
def item_update_type(request, code):
    tag_type = request.POST.get("tag_type", None)

    vendor = Vendor.get_vendor(request.user)
    item = get_object_or_404(Item.objects, code=code, vendor=vendor)
    item.type = tag_type
    item.save()
    return HttpResponse()


@login_required
@require_http_methods(["POST"])
def all_to_print(request):
    vendor = Vendor.get_vendor(request.user)
    items = Item.objects.filter(vendor=vendor).filter(printed=False).filter(box__isnull=True)

    items.update(printed=True)

    return HttpResponse()

@login_required
@require_http_methods(["POST"])
@require_vendor_open
def box_add(request):
    vendor = Vendor.get_vendor(request.user)
    description = request.POST.get("description", u"").strip()
    item_title = request.POST.get("item_title", "uu").strip()
    count_str = request.POST.get("count", u"")
    price = request.POST.get("price")
    item_type = request.POST.get("itemtype", u"")
    adult = request.POST.get("adult", "no")

    if not item_type:
        return HttpResponseBadRequest(_(u"Item must have a type."))

    # Format price
    try:
        price = ItemPriceField().clean(price)
    except ValidationError as error:
        return HttpResponseBadRequest(u' '.join(error.messages))

    # Verify that user doesn't exceed his/hers item quota with the box.
    max_items = settings.KIRPPU_MAX_ITEMS_PER_VENDOR
    item_cnt = Item.objects.filter(vendor=vendor).count()
    count = int(count_str)
    if item_cnt >= max_items:
        error_msg = _(u"You have %(max_items)s items, which is the maximum. No more items can be registered.")
        return HttpResponseBadRequest(error_msg % {'max_items': max_items})
    elif max_items < count + item_cnt:
        error_msg = _(u"You have %(item_cnt)s items. "
                      u"Creating this box would cause the items to exceed the maximum number of allowed items.")
        return HttpResponseBadRequest(error_msg % {'max_items': max_items})

    # Create the box and items. and construct a response containing box and all the items that have been added.
    box = Box.new(
        description=description,
        count=count,
        item_title=item_title,
        price=str(price),
        vendor=vendor,
        state=Item.ADVERTISED,
        itemtype=item_type,
        adult=adult)

    box_dict = {
        'vendor_id': vendor.id,
        'box_id': box.id,
        'description': box.description,
        'item_price': str(box.get_price_fmt()),
        'item_count': box.get_item_count(),
        'item_type': box.get_item_type_for_display(),
        'item_adult': box.get_item_adult()
    }
    response = box_dict

    return HttpResponse(json.dumps(response), 'application/json')


@login_required
@require_http_methods(["POST"])
def box_hide(request, box_id):

    with transaction.atomic():

        vendor = Vendor.get_vendor(request.user)
        box = get_object_or_404(Box.objects, id=box_id)
        box_vendor = box.get_vendor()
        if box_vendor.id != vendor.id:
            raise Http404()

        items = box.get_items()
        for item in items:
            item.hidden = True
            item.save()

    return HttpResponse()


def _vendor_menu_contents(request):
    """
    Generate menu for Vendor views.
    Returned tuple contains entries for the menu, each entry containing a
    name, url, and flag indicating whether the entry is currently active
    or not.

    :param request: Current request being processed.
    :return: List of menu items containing name, url and active fields.
    :rtype: tuple[MenuItem,...]
    """
    active = request.resolver_match.view_name
    menu_item = namedtuple("MenuItem", "name url active sub_items")
    fill = lambda name, func, sub=None: menu_item(name, url.reverse(func) if func else None, func == active, sub)

    items = [
        fill(_(u"Home"), "kirppu:vendor_view"),
        fill(_(u"Item list"), "kirppu:page"),
        fill(_(u"Box list"), "kirppu:vendor_boxes"),
    ]

    manage_sub = []
    if request.user.is_staff or UserAdapter.is_clerk(request.user):
        manage_sub.append(fill(_(u"Checkout commands"), "kirppu:commands"))
    if request.user.is_staff:
        manage_sub.append(fill(_(u"Clerk codes"), "kirppu:clerks"))
        manage_sub.append(fill(_(u"Lost and Found"), "kirppu:lost_and_found"))

    if manage_sub:
        items.append(fill(_(u"Management"), "", manage_sub))
    return items


@login_required
@require_http_methods(["GET"])
@barcode_view
def get_items(request, bar_type):
    """
    Get a page containing all items for vendor.

    :param request: HttpRequest object.
    :type request: django.http.request.HttpRequest
    :return: HttpResponse or HttpResponseBadRequest
    """

    user = request.user
    if user.is_staff and "user" in request.GET:
        user = get_object_or_404(get_user_model(), username=request.GET["user"])
    tag_type = request.GET.get("tag", "short").lower()
    if tag_type not in ('short', 'long'):
        return HttpResponseBadRequest(u"Tag type not supported")

    vendor = Vendor.get_vendor(user)
    vendor_items = Item.objects.filter(vendor=vendor, hidden=False, box__isnull=True)
    items = vendor_items.filter(printed=False)
    printed_items = vendor_items.filter(printed=True)

    # Order from newest to oldest, because that way new items are added
    # to the top and the user immediately sees them without scrolling
    # down.
    items = items.order_by('-id')

    render_params = {
        'items': items,
        'printed_items': printed_items,
        'bar_type': bar_type,
        'tag_type': tag_type,

        'profile_url': settings.PROFILE_URL,

        'is_registration_open': is_vendor_open(),
        'menu': _vendor_menu_contents(request),
        'Item': Item,
    }

    return render(request, "kirppu/app_items.html", render_params)


@login_required
@require_http_methods(["GET"])
@barcode_view
def get_boxes(request, bar_type):
    """
    Get a page containing all boxes for vendor.

    :param request: HttpRequest object.
    :type request: django.http.request.HttpRequest
    :return: HttpResponse or HttpResponseBadRequest
    """

    user = request.user
    if user.is_staff and "user" in request.GET:
        user = get_object_or_404(get_user_model(), username=request.GET["user"])
    tag_type = request.GET.get("tag", "short").lower()
    if tag_type not in ('short', 'long'):
        return HttpResponseBadRequest(u"Tag type not supported")

    vendor = Vendor.get_vendor(user)
    boxes = Box.objects.filter(item__vendor=vendor, item__hidden=False).distinct()
    printed_boxes = Box.objects.filter(item__vendor=vendor, item__hidden=False, item__printed=True).distinct()

    # Order from newest to oldest, because that way new boxes are added
    # to the top and the user immediately sees them without scrolling
    # down.
    boxes = boxes.order_by('-id')

    render_params = {
        'boxes': boxes,
        'printed_boxes': printed_boxes,
        'vendor_id_param': vendor.id,

        'profile_url': settings.PROFILE_URL,

        'is_registration_open': is_vendor_open(),
        'menu': _vendor_menu_contents(request),
    }

    return render(request, "kirppu/app_boxes.html", render_params)


def get_barcode(request, data, ext):
    """
    Render the data as a barcode.

    :param request: HttpRequest object
    :type request: django.http.request.HttpRequest

    :param data: Data to render
    :type data: str

    :param ext: Filename extension of the preferred format
    :type ext: str

    :return: Response containing the raw image data
    :rtype: HttpResponse
    """
    if ext not in ('svg', 'png', 'gif', 'bmp'):
        return HttpResponseBadRequest(u"Image extension not supported")

    # FIXME: TypeError if PIL is not installed
    writer, mime_type = PixelWriter(format=ext), 'image/' + ext

    bar = barcode.Code128(data, writer=writer)

    response = HttpResponse(content_type=mime_type)
    bar.write(response, {
        'module_width': 1,  # pixels per smallest line
    })

    return response


@login_required
@require_test(lambda request: request.user.is_staff)
@barcode_view
def get_clerk_codes(request, bar_type):
    items = []
    code_item = namedtuple("CodeItem", "name code")

    for c in Clerk.objects.filter(access_key__isnull=False):
        if not c.is_valid_code:
            continue
        code = c.get_code()
        if c.user is not None:
            name = c.user.get_short_name()
            if len(name) == 0:
                name = c.user.get_username()
        else:
            name = ""

        items.append(code_item(name=name, code=code))

    width = KirppuBarcode.length(items[0].code, PixelWriter) if items else 100
    return render(request, "kirppu/app_clerks.html", {
        'items': items,
        'bar_type': bar_type,
        'repeat': range(1),
        'barcode_width': width,
    })


@login_required
@require_test(lambda request: request.user.is_staff or UserAdapter.is_clerk(request.user))
@barcode_view
def get_counter_commands(request, bar_type):
    return render(request, "kirppu/app_commands.html", {
        'title': _(u"Counter commands"),
    })


# Access control by settings.
# CSRF is not generated if the Checkout-mode is not activated in settings.
@require_setting("KIRPPU_CHECKOUT_ACTIVE", True)
@ensure_csrf_cookie
def checkout_view(request):
    """
    Checkout view.

    :param request: HttpRequest object
    :type request: django.http.request.HttpRequest
    :return: Response containing the view.
    :rtype: HttpResponse
    """
    clerk_logout_fn(request)
    context = {}
    if settings.KIRPPU_AUTO_CLERK and settings.DEBUG:
        if isinstance(settings.KIRPPU_AUTO_CLERK, (str, unicode)):
            real_clerks = Clerk.objects.filter(user__username=settings.KIRPPU_AUTO_CLERK)
        else:
            real_clerks = Clerk.objects.filter(user__isnull=False)
        for clerk in real_clerks:
            if clerk.is_enabled:
                context["auto_clerk"] = clerk.get_code()
                break

    return render(request, "kirppu/app_checkout.html", context)


@require_setting("KIRPPU_CHECKOUT_ACTIVE", True)
@ensure_csrf_cookie
def overseer_view(request):
    """Overseer view."""
    try:
        ajax_util.get_counter(request)
        ajax_util.require_overseer_clerk_login(lambda _: None)(request)
    except ajax_util.AjaxError:
        return redirect('kirppu:checkout_view')
    else:
        context = {
            'itemtypes': Item.ITEMTYPE,
            'itemstates': Item.STATE,
        }
        return render(request, 'kirppu/app_overseer.html', context)


@require_setting("KIRPPU_CHECKOUT_ACTIVE", True)
@ensure_csrf_cookie
def stats_view(request):
    """Stats view."""
    try:
        ajax_util.get_counter(request)
        ajax_util.require_clerk_login(lambda _: None)(request)
    except ajax_util.AjaxError:
        return redirect('kirppu:checkout_view')

    class ItemStats(object):
        """Interface for app_stats.html template.

        Constructors:
            __init__: fetches property values for model.
            sum_stats: takes a list of ItemStats instances and sums their properties.

        Properties:
            property_names: Iterates over all property names.
            property_values: Iterates over all property values.

            All properties listed in property_names are also accessible through attributes.

        """
        _properties = {
            'advertized': Item.ADVERTISED,
            'brought': Item.BROUGHT,
            'staged': Item.STAGED,
            'sold': Item.SOLD,
            'missing': Item.MISSING,
            'returned': Item.RETURNED,
            'compensated': Item.COMPENSATED,
            'sum': None,
        }

        def __init__(self, item_type=None, type_name=None, vendor=None):
            for property in self._properties:
                setattr(self, property, 'NOT IMPLEMENTED')

            if type_name:
                self.type = type_name
            else:
                self.type = 'Vendor {}'.format(vendor)

            self.values = {}

            # Initialize self._items for subclass.
            if not item_type and not vendor:
                self._items = None
            else:
                items = Item.objects
                if item_type:
                    items = items.filter(itemtype=item_type)
                if vendor:
                    items = items.filter(vendor_id=vendor)
                self._items = items

                self.init_values()
                self.init_properties()

        def init_values(self):
            # Call subclasses implementation of get_value to populate the property values.
            for property_name, item_type in self._properties.items():
                if property_name is 'sum':
                    continue
                self.values[property_name] = self.get_value(item_type)
            self.values['sum'] = sum(self.values.values())

        def get_value(self, item_type):
            raise NotImplementedError()

        @property
        def property_values(self):
            for property_name in self._properties:
                yield getattr(self, property_name)
            yield self.sum

        @property
        def property_names(self):
            for property_name in self._properties:
                yield property_name
            yield 'Sum'

        @classmethod
        def sum_stats(cls, list_of_stats):
            """Return a new instance with all properties the sum of the input stats properties."""
            new_stats = cls(None, 'Sum')

            for property_name in new_stats._properties:
                property_sum = 0
                for stats in list_of_stats:
                    property_sum += stats.values[property_name]

                new_stats.values[property_name] = property_sum

            new_stats.init_properties()
            return new_stats

    class ItemCounts(ItemStats):
        def get_value(self, item_state):
            return self._items.filter(state=item_state).count()

        def init_properties(self):
            for property in self._properties:
                value = str(self.values[property])
                setattr(self, property, value)

    class ItemEuros(ItemStats):
        def get_value(self, item_state):
            query = self._items.filter(state=item_state).aggregate(Sum('price'))
            price = query['price__sum'] or 0
            return price

        def init_properties(self):
            for property in self._properties:
                value = "{}&nbsp;&euro;".format(self.values[property])
                setattr(self, property, value)

    number_of_items = [ItemCounts(item_type, type_name) for item_type, type_name in Item.ITEMTYPE]
    number_of_items.append(ItemCounts.sum_stats(number_of_items))

    number_of_euros = [ItemEuros(item_type, type_name) for item_type, type_name in Item.ITEMTYPE]
    number_of_euros.append(ItemEuros.sum_stats(number_of_euros))

    vendors = Vendor.objects.all()
    vendor_items = []
    for vendor in vendors:
        vendor_items.append(ItemCounts(vendor=vendor.id))
        vendor_items.append(ItemEuros(vendor=vendor.id))

    context = {
        'number_of_items': number_of_items,
        'number_of_euros': number_of_euros,
        'vendor_items': vendor_items,
    }

    return render(request, 'kirppu/app_stats.html', context)


def vendor_view(request):
    """
    Render main view for vendors.

    :rtype: HttpResponse
    """
    user = request.user

    if user.is_authenticated():
        vendor = Vendor.get_vendor(user)
        items = Item.objects.filter(vendor=vendor, hidden=False, box__isnull=True)
    else:
        items = []

    context = {
        'user': user,
        'items': items,

        'total_price': sum(i.price for i in items),
        'num_total': len(items),
        'num_printed': len(filter(lambda i: i.printed, items)),

        'profile_url': settings.PROFILE_URL,
        'menu': _vendor_menu_contents(request),
    }
    return render(request, "kirppu/app_frontpage.html", context)


def _get_login_destination(request, dest_url):
    destination = request.REQUEST.get('next')
    if not is_safe_url(destination, request.get_host()):
        destination = request.build_absolute_uri(url.reverse('kirppu:vendor_view'))
    login_url = '{0}?{1}'.format(
        dest_url,
        urllib.urlencode({'next': destination}),
    )
    return login_url


@require_setting("KIRPPU_USE_SSO", True)
@never_cache
def login_view(request):
    """
    Redirect to SSO login page.
    """
    login_url = _get_login_destination(request, settings.LOGIN_URL)
    return redirect(login_url)


@require_setting("KIRPPU_USE_SSO", True)
@never_cache
def logout_view(request):
    """
    Log out user and redirect to SSO logout page.
    """
    logout(request)
    logout_url = _get_login_destination(request, settings.LOGOUT_URL)
    return redirect(logout_url)


@login_required
def remove_item_from_receipt(request):
    if not request.user.is_staff:
        raise PermissionDenied()

    form = get_form(ItemRemoveForm, request)

    if request.method == "POST" and form.is_valid():
        form.save()
        return HttpResponseRedirect(url.reverse('kirppu:remove_item_from_receipt'))

    return render(request, "kirppu/app_item_receipt_remove.html", {
        'form': form,
    })


@login_required
@require_test(lambda request: request.user.is_staff)
def lost_and_found_list(request):
    items = Item.objects.select_related("vendor").filter(lost_property=True, abandoned=False).order_by("vendor", "name")

    vendor_object = namedtuple("VendorItems", "vendor vendor_id items")

    vendor_list = {}
    for item in items:
        vendor_id = item.vendor_id
        if vendor_id not in vendor_list:
            vendor_list[vendor_id] = vendor_object(item.vendor.user, item.vendor_id, [])

        vendor_list[vendor_id].items.append(item)

    return render(request, "kirppu/lost_and_found.html", {
        'menu': _vendor_menu_contents(request),
        'items': vendor_list,
    })

from django.db import IntegrityError
from django.conf import settings
from django.contrib import admin, messages
from django.core.urlresolvers import reverse
from django.utils.html import escape
from django.utils.translation import ugettext

from .forms import (
    ClerkGenerationForm,
    ReceiptItemAdminForm,
    ReceiptAdminForm,
    UITextForm,
    ClerkEditForm,
    ClerkSSOForm,
    VendorSetSelfForm,
)

from .models import Clerk, Item, Vendor, Counter, Receipt, ReceiptItem, UIText, ItemStateLog, Box

__author__ = 'jyrkila'


def _gen_ean(modeladmin, request, queryset):
    for item in queryset:
        if item.code is None or len(item.code) == 0:
            item.code = Item.gen_barcode()
            item.save(update_fields=["code"])
_gen_ean.short_description = ugettext(u"Generate bar codes for items missing it")


def _del_ean(modeladmin, request, queryset):
    queryset.update(code="")
_del_ean.short_description = ugettext(u"Delete generated bar codes")


def _regen_ean(modeladmin, request, queryset):
    _del_ean(modeladmin, request, queryset)
    _gen_ean(modeladmin, request, queryset)
_regen_ean.short_description = ugettext(u"Re-generate bar codes for items")


class ItemAdmin(admin.ModelAdmin):
    actions = [_gen_ean, _del_ean, _regen_ean]
    list_display = ('name', 'code', 'price', 'state', 'vendor')
    ordering = ('vendor', 'name')
    search_fields = ['name', 'code']
admin.site.register(Item, ItemAdmin)


def _user_link(obj):
    """
    Admin UI list column that displays user name with link to the user model itself.

    :param obj: Object being listed, such as Clerk or Vendor.
    :type obj: Clerk | Vendor | T
    :return: Contents for the field.
    :rtype: unicode
    """
    user = obj.user
    if user is None:
        return u"(None)"
    # noinspection PyProtectedMember
    info = user._meta.app_label, user._meta.model_name
    return u'<a href="{0}">{1}</a>'.format(
        reverse("admin:%s_%s_change" % info, args=(user.id,)),
        escape(user)
    )
_user_link.allow_tags = True
_user_link.short_description = ugettext(u"User")


class VendorAdmin(admin.ModelAdmin):
    ordering = ('user__first_name', 'user__last_name')
    search_fields = ['user__first_name', 'user__last_name', 'user__username']
    list_display = ['id', _user_link]

    @staticmethod
    def _can_set_user(request, obj):
        return obj is not None and\
            request.user.is_superuser and\
            not obj.user.is_superuser and\
            settings.KIRPPU_SU_AS_USER

    def get_form(self, request, obj=None, **kwargs):
        if self._can_set_user(request, obj):
            kwargs["form"] = VendorSetSelfForm
        return super(VendorAdmin, self).get_form(request, obj, **kwargs)

    def get_readonly_fields(self, request, obj=None):
        return ["user"] if obj is not None and not self._can_set_user(request, obj) else []

admin.site.register(Vendor, VendorAdmin)


# noinspection PyMethodMayBeStatic
class ClerkAdmin(admin.ModelAdmin):
    actions = ["_gen_clerk_code", "_del_clerk_code", "_move_clerk_code"]
    list_display = ('id', _user_link, 'access_code', 'access_key', 'is_enabled')
    ordering = ('user__first_name', 'user__last_name')
    search_fields = ['user__first_name', 'user__last_name', 'user__username']
    exclude = ['access_key']

    def _gen_clerk_code(self, request, queryset):
        for clerk in queryset:
            if not clerk.is_valid_code:
                clerk.generate_access_key()
                clerk.save(update_fields=["access_key"])
    _gen_clerk_code.short_description = ugettext(u"Generate missing Clerk access codes")

    def _del_clerk_code(self, request, queryset):
        for clerk in queryset:
            while True:
                clerk.generate_access_key(disabled=True)
                try:
                    clerk.save(update_fields=["access_key"])
                except IntegrityError:
                    continue
                else:
                    break
    _del_clerk_code.short_description = ugettext(u"Delete Clerk access codes")

    def _move_error(self, request):
        self.message_user(request,
                          ugettext(u"Must select exactly one 'unbound' and one 'bound' Clerk for this operation"),
                          messages.ERROR)

    def _move_clerk_code(self, request, queryset):
        if len(queryset) != 2:
            self._move_error(request)
            return

        # Guess the order.
        unbound = queryset[0]
        bound = queryset[1]
        if queryset[1].user is None:
            # Was wrong, swap around.
            bound, unbound = unbound, bound

        if unbound.user is not None or bound.user is None:
            # Selected wrong rows.
            self._move_error(request)
            return

        # Assign the new code to be used. Remove the unbound item first, so unique-check doesn't break.
        bound.access_key = unbound.access_key
        unbound.delete()
        bound.save(update_fields=["access_key"])
        self.message_user(request, ugettext(u"Access code set for '{0}'").format(bound.user))
    _move_clerk_code.short_description = ugettext(u"Move unused access code to existing Clerk.")

    def get_form(self, request, obj=None, **kwargs):
        if "unbound" in request.GET:
            # Custom form for creating multiple Clerks at same time.
            return ClerkGenerationForm

        # Custom creation form if SSO is enabled.
        if obj is None and settings.KIRPPU_USE_SSO:
            return ClerkSSOForm

        # Custom form for editing already created Clerks.
        if obj is not None:
            return ClerkEditForm

        return super(ClerkAdmin, self).get_form(request, obj, **kwargs)

    def has_change_permission(self, request, obj=None):
        # Don't allow changing unbound Clerks. That might create unusable codes (because they are not printed).
        if obj is not None and obj.user is None:
            return False
        return True

    def save_related(self, request, form, formsets, change):
        if isinstance(form, (ClerkGenerationForm, ClerkEditForm, ClerkSSOForm)):
            # No related fields...
            return
        return super(ClerkAdmin, self).save_related(request, form, formsets, change)

    def save_model(self, request, obj, form, change):
        if change and isinstance(form, ClerkEditForm):
            # Need to save the form instead of obj.
            form.save()
        else:
            super(ClerkAdmin, self).save_model(request, obj, form, change)

    def log_addition(self, request, object):
        if isinstance(object, ClerkGenerationForm):
            # Log all added items separately.
            for item in object.saved_list:
                super(ClerkAdmin, self).log_addition(request, item)
            return
        super(ClerkAdmin, self).log_addition(request, object)


admin.site.register(Clerk, ClerkAdmin)

admin.site.register(Counter)


class UITextAdmin(admin.ModelAdmin):
    model = UIText
    ordering = ["identifier"]
    form = UITextForm
    list_display = ["identifier", "text_excerpt"]

admin.site.register(UIText, UITextAdmin)


class ReceiptItemAdmin(admin.TabularInline):
    model = ReceiptItem
    ordering = ["add_time"]
    form = ReceiptItemAdminForm
    readonly_fields = ["item"]


class ReceiptAdmin(admin.ModelAdmin):
    inlines = [
        ReceiptItemAdmin,
    ]
    ordering = ["clerk", "start_time"]
    list_display = ["__unicode__", "status", "total", "counter", "sell_time"]
    form = ReceiptAdminForm
    search_fields = ["items__code", "items__name"]

    def has_delete_permission(self, request, obj=None):
        return False
admin.site.register(Receipt, ReceiptAdmin)


class ItemStateLogAdmin(admin.ModelAdmin):
    model = ItemStateLog
    ordering = ["-id"]
    search_fields = ['item__code']
    list_display = ['id', 'time', 'item', 'old_state', 'new_state']

admin.site.register(ItemStateLog, ItemStateLogAdmin)

admin.site.register(Box)

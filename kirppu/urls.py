from django.conf.urls import patterns, url, include
from django.conf import settings

from .views import get_clerk_codes, get_counter_commands, get_barcode, checkout_view, vendor_view, \
    get_items, all_to_print, item_add, item_to_printed, item_to_not_printed, item_update_name, item_update_type, \
    item_update_price, remove_item_from_receipt
from .checkout_api import AJAX_FUNCTIONS, checkout_js

__author__ = 'jyrkila'

_urls = [
    url(r'^clerks/$', get_clerk_codes, name='clerks'),
    url(r'^commands/$', get_counter_commands),
    url(r'^barcode/(?P<data>\w+?)\.(?P<ext>\w+)$', get_barcode, name='barcode'),
    url(r'^checkout/$', checkout_view),
    url(r'^vendor/$', vendor_view, name='vendor_view'),
    url(r'^vendor/items/$', get_items, name='page'),
    url(r'^vendor/items/move_to_print$', all_to_print, name='all_to_print'),
    url(r'^vendor/item/$', item_add, name='item_add'),
    url(r'^vendor/item/(?P<code>\w+?)/to_printed$', item_to_printed, name='item_to_printed'),
    url(r'^vendor/item/(?P<code>\w+?)/price$', item_update_price, name='item_update_price'),
    url(r'^vendor/item/(?P<code>\w+?)/name$', item_update_name, name='item_update_name'),
    url(r'^vendor/item/(?P<code>\w+?)/type$', item_update_type, name='item_update_type'),
    url(r'^vendor/item/(?P<code>\w+?)/to_not_printed$', item_to_not_printed, name='item_to_not_printed'),
    url(r'^remove_item', remove_item_from_receipt, name='remove_item_from_receipt'),
]

if settings.KIRPPU_CHECKOUT_ACTIVE:  # Only activate API when checkout is active.
    _urls.append(url('^api/checkout.js/$', checkout_js, name='checkout_js'))
    _urls.extend([
        url(func.url, "kirppu.checkout_api.%s" % func.name, name=func.view_name)
        for func in AJAX_FUNCTIONS.itervalues()
    ])

urlpatterns = patterns('', *_urls)

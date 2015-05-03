import base64
from collections import OrderedDict
from cStringIO import StringIO
import re

import barcode
from barcode.charsets import code128
from django import template
from django.template import Node, TemplateSyntaxError
from django.conf import settings
from django.utils.encoding import force_text
from django.utils.functional import memoize
from django.utils.html import format_html
from ..utils import PixelWriter
from ..models import UIText, UserAdapter

register = template.Library()

class FifoDict(OrderedDict):
    def __init__(self, *args, **kwargs):
        self.limit = kwargs.pop("limit", None)
        OrderedDict.__init__(self, *args, **kwargs)
        self._remove_oldest()

    def __setitem__(self, key, value):
        OrderedDict.__setitem__(self, key, value)
        self._remove_oldest()

    def _remove_oldest(self):
        if not self.limit:
            return

        while len(self) > self.limit:
            self.popitem(last=False)


# Limit the size of the dict to a reasonable number so that we don't have
# millions of dataurls cached.
barcode_dataurl_cache = FifoDict(limit=50000)


class KirppuBarcode(barcode.Code128):
    """Make sure barcode is always the same width"""

    def _maybe_switch_charset(self, pos):
        """Do not switch ever."""
        char = self.code[pos]
        assert(char in code128.B)
        return []

    def _try_to_optimize(self, encoded):
        return encoded

    @staticmethod
    def length(text, writer):
        """
        Get expected image width for given text when using given writer.

        :param text: Text to be encoded or length of the text.
        :type text: str | unicode | int
        :param writer: Writer used to write. Expected to be able tell its total quiet zone size.
        :return: Width of the resulting image.
        :rtype: int
        """
        # Text is actually going to be text+LF. CH=11, (START=11, END=13)=24
        if not isinstance(text, int):
            length = len(text)
        else:
            length = text
        return (length + 1) * 11 + 24 + writer.quiet_zone()


@register.simple_tag
def load_text(id_):
    try:
        return UIText.objects.get(identifier=id_).text
    except UIText.DoesNotExist:
        if settings.DEBUG:
            return format_html(
                u'<span style="background-color: lightyellow;'
                u' color: black;'
                u' border: 1px solid gray;">'
                u'Missing text {0}.</span>'.format(
                    force_text(id_)
                )
            )
        return u""


@register.simple_tag
def load_texts(id_, wrap=None):
    """
    Output multiple UIText values. If id is not found, only empty string is returned.

    :param id_: Start of id string to find.
    :type id_: str | unicode
    :param wrap: Optional wrapping tag content (such as p). If whitespace, that is used instead.
    :type wrap: str | unicode | None
    :return: str | unicode
    """
    texts = UIText.objects.filter(identifier__startswith=id_).order_by("identifier").values_list("text", flat=True)
    if not texts:
        return u""

    begin = u""
    end = u""
    joined = u""
    if wrap is not None:
        trimmed = wrap.strip()
        if len(trimmed) > 0:
            begin = format_html(u'<{0}>', trimmed)
            end = format_html(u'</{0}>', trimmed.split(" ")[0])
            joined = begin + end
        else:
            joined = wrap

    return begin + joined.join(texts) + end


def generate_dataurl(code, ext, expect_width=143):
    if not code:
        return ''

    writer = PixelWriter(format=ext)
    mime_type = 'image/' + ext

    # PIL only writes to
    bar = KirppuBarcode(code, writer=writer)
    memory_file = StringIO()
    pil_image = bar.render({
        'module_width': 1
    })

    width, height = pil_image.size

    # These measurements have to be exactly the same as the ones used in
    # price_tags.css. If they are not the image might be distorted enough
    # to not register on the scanner.
    if settings.DEBUG:
        assert(height == 1)
        assert(expect_width is None or width == expect_width)

    pil_image.save(memory_file, format=ext)
    data = memory_file.getvalue()

    dataurl_format = 'data:{mime_type};base64,{base64_data}'
    return dataurl_format.format(
        mime_type=mime_type,
        base64_data=base64.encodestring(data)
    )
get_dataurl = memoize(generate_dataurl, barcode_dataurl_cache, 2)


@register.simple_tag
def barcode_dataurl(code, ext, expect_width=143):
    return get_dataurl(code, ext, expect_width)


@register.simple_tag
def barcode_css(low=4, high=6, target=None, container=None, compress=False):
    target = target or ".barcode_img.barcode_img{0}"
    container = container or ".barcode_container.barcode_container{0}"

    css = """
        {target}, {container} {{
            width: {px}px;
            background-color: white;
        }}
    """

    output = []
    for code_length in range(low, high + 1):
        px = KirppuBarcode.length(code_length, PixelWriter)
        for multiplier in range(1, 3):
            suffix = "_" + str(code_length) + "_" + str(multiplier)
            mpx = px * multiplier
            rule = css.format(
                target=target.format(suffix),
                container=container.format(suffix),
                px=mpx,
            )
            if compress:
                rule = re.sub(r'[\s]+', "", rule)
            output.append(rule)
    return "".join(output)


@register.filter
def user_adapter(user, getter):
    """
    Filter for using UserAdapter for user objects.

    :param user: User to filter, class of `settings.USER_MODEL`.
    :param getter: Getter function to apply to the user via adapter.
    :type getter: str
    """
    if not isinstance(getter, (str, unicode)) or getter.startswith("_"):
        raise AttributeError("Invalid adapter attribute.")

    getter = getattr(UserAdapter, getter)
    return getter(user)


# https://djangosnippets.org/snippets/660/
class SplitListNode(Node):
    def __init__(self, list_string, chunk_size, new_list_name):
        self.list = list_string
        self.chunk_size = chunk_size
        self.new_list_name = new_list_name

    def split_seq(self, seq, size):
        """ Split up seq in pieces of size, from
        http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/425044"""
        return [seq[i:i+size] for i in range(0, len(seq), size)]

    def render(self, context):
        context[self.new_list_name] = self.split_seq(context[self.list], int(self.chunk_size))
        return ''

def split_list(parser, token):
    """<% split_list list as new_list 5 %>"""
    bits = token.contents.split()
    if len(bits) != 5:
        raise TemplateSyntaxError, "split_list list as new_list 5"
    return SplitListNode(bits[1], bits[4], bits[3])

split_list = register.tag(split_list)
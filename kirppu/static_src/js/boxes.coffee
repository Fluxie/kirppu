
class BoxesConfig
  url_args:
    # This is used to move urls with arguments from django to JS.
    # It has to satisfy the regexp of the url in django.
    code: ''

  urls:
    roller: ''
    box_add: ''

  enabled: true

  constructor: ->

C = new BoxesConfig


createBox = (name, price, vendor_id, code, dataurl, type, adult) ->
  # Find the hidden template element, clone it and replace the contents.
  tag = $(".box_template").clone();
  tag.removeClass("box_template");

  if (type == "short") then tag.addClass("box_short")
  if (type == "tiny") then tag.addClass("box_tiny")

  $('.box_name', tag).text(name)
  $('.box_price', tag).text(price)
  $('.box_head_price', tag).text(price)

  if adult == "yes"
    $('.box_adult_tag', tag).text("K-18")

  $('.box_vendor_id', tag).text(vendor_id)

  $(tag).attr('id', code)
  $('.box_extra_code', tag).text(code)

  $('.barcode_container > img', tag).attr('src', dataurl)


  if listViewIsOn
    tag.addClass('box_list')

  return tag


# Add a bx with name and price set to form contents.
addBox = ->
  onSuccess = (items) ->
    $('#form-errors').empty()
    for item in items
      tag = createTag(item.name, item.price, item.vendor_id, item.code, item.barcode_dataurl, item.type, item.adult)
      $('#boxes').prepend(tag)
      bindTagEvents($(tag))

  onError = (jqXHR, textStatus, errorThrown) ->
    $('#form-errors').empty()
    if jqXHR.responseText
      $('<p>' + jqXHR.responseText + '</p>').appendTo($('#form-errors'))

  content =
    name: $("#box-add-name").val()
    price: $("#box-add-price").val()
    count: $("#box-add-count").val()
    type: $("input[name=count-add-type]:checked").val()
    itemtype: $("#box-add-itemtype").val()
    adult: $("input[name=box-add-adult]:checked").val()

  $.ajax(
    url: C.urls.box_add
    type: 'POST'
    data: content
    success: onSuccess
    error: onError
  )


deleteAll = ->
  if not confirm(gettext("This will mark all boxes as printed so they won't be printed again accidentally. Continue?"))
    return

  tags = $('#items > .box_container')
  $(tags).hide('slow')

  $.ajax(
    url:  C.urls.all_to_print
    type: 'POST'
    success: ->
      $(tags).each((index, tag) ->
        code = $(tag).attr('id')
        moveTagToPrinted(tag, code)
      )
    error: ->
      $(tags).show('slow')
  )

  return


onPriceChange = ->
  input = $(this)
  formGroup = input.parents(".form-group")

  # Replace ',' with '.' in order to accept numbers with ',' as the period.
  value = input.val().replace(',', '.')
  if value > 400 or value <= 0 or not Number.isConvertible(value)
    formGroup.addClass('has-error')
  else
    formGroup.removeClass('has-error')

  return


bindFormEvents = ->
  $('#box-add-form').bind('submit', ->
    addBox();
    return false;
  )

  return


window.boxesConfig = C
window.addBox = addBox
window.deleteAll = deleteAll
window.bindFormEvents = bindFormEvents

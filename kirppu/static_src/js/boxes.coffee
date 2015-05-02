
class BoxesConfig
  url_args:
    # This is used to move urls with arguments from django to JS.
    # It has to satisfy the regexp of the url in django.
    box_id: ''

  urls:
    roller: ''
    box_add: ''
    box_hide: ''

  enabled: true

  constructor: ->

  box_hide_url: (box_id) ->
    url = @urls.box_hide
    return url.replace(@url_args.box_id, box_id)

C = new BoxesConfig


createBox = (description, item_count, item_price, vendor_id, item_type, item_adult) ->
  # Find the hidden template element, clone it and replace the contents.
  box = $(".box_template").clone();
  box.removeClass("box_template");
  box.addClass("box_short")

  $('.box_description', box).text(description)
  $('.item_count', box).text(item_count)
  $('.item_price', box).text(item_price)
  $('.item_type', box).text(item_type)

  if item_adult == "yes"
    $('.item_adult', box).text("K-18")
  else
    $('.item_adult', box).text("-")

  $('.box_vendor_id', box).text(vendor_id)

  return box


# Add a box with name and price set to form contents.
addBox = ->
  onSuccess = (box) ->
    $('#form-errors').empty()
    box = createBox(box.description, box.item_count, box.item_price, box.vendor_id, box.item_type, box.item_adult)
    $('#boxes').prepend(box)
    bindBoxEvents($(box))

  onError = (jqXHR, textStatus, errorThrown) ->
    $('#form-errors').empty()
    if jqXHR.responseText
      $('<p>' + jqXHR.responseText + '</p>').appendTo($('#form-errors'))

  content =
    description: $("#box-add-description").val()
    item_title: $("#box-add-itemtitle").val()
    count: $("#box-add-count").val()
    price: $("#box-add-price").val()
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

  boxes = $('#boxes > .box_container')
  $(boxes).hide('slow')

  $.ajax(
    url:  C.urls.all_to_print
    type: 'POST'
    success: ->
      $(tags).each((index, box) ->
        box_id = $(tag).attr('id')
        moveBoxToPrinted(tag, box_id)
      )
    error: ->
      $(tags).show('slow')
  )

  return

hideBox = (box, box_id) ->
  $.ajax(
    url: C.box_hide_url(box_id)
    type: 'POST'
    success: ->
      $(box).remove()
    error: ->
      $(box).show('slow')
  )

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
    $('#box-add-form')[0].reset();
    return false;
  )

  return

# Bind events for a set of '.item_container' elements.
# @param tags [jQuery set] A set of '.item_container' elements.
bindBoxEvents = (boxes) ->
  boxes.each((index, box) ->
    box = $(box)
    box_id = box.attr('id')

    bindBoxHideEvents(box, box_id)
    # bindItemToPrintedEvents(box, box_id)

    return
  )
  return

bindBoxHideEvents = (box, box_id) ->
  $('.box_button_hide', box).click( ->
    $(box).hide('slow', -> hideBox(box, box_id))
  )


window.boxesConfig = C
window.addBox = addBox
window.deleteAll = deleteAll
window.bindBoxEvents = bindBoxEvents
window.bindFormEvents = bindFormEvents

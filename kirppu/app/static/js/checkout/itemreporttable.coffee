class @ItemReportTable extends ItemReceiptTable
  constructor: ->
    super
    @head.append($('<th class="receipt_status">status</th>'))

  append: (code, name, price, state) ->
    data = [
      @body.children().length + 1,
      code, name, price, state,
    ]
    row = $('<tr>').append(data.map((t) -> $('<td>').text(t)))
    @body.append(row)

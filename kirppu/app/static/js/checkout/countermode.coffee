class @CounterMode extends ItemCheckoutMode
  ModeSwitcher.registerEntryPoint("customer_checkout", @)

  constructor: (args..., modeArgs) ->
    super(args...)
    @_receipt = new ReceiptData()
    @receiptSum = new ReceiptSum()
    if modeArgs?
      @restoreReceipt(modeArgs)
    @receipt.body.attr("id", "counter_receipt")

  glyph: -> "euro"
  title: -> "Checkout"

  actions: -> [
    [@cfg.settings.abortPrefix,       @onAbortReceipt]
    [@cfg.settings.logoutPrefix,      @onLogout]
    [@cfg.settings.payPrefix,         @onPayReceipt]
    [@cfg.settings.removeItemPrefix,  @onRemoveItem]
    ["",                              @onAddItem]
  ]

  enter: ->
    @cfg.uiRef.body.append(@receiptSum.render())
    super
    @_setSum()

  addRow: (code, item, price, rounded=false) ->
    if code?
      @_receipt.rowCount++
      index = @_receipt.rowCount
      if price? and price < 0 then index = -index
    else
      code = ""
      index = ""

    row = @createRow(index, code, item, price, rounded)
    @receipt.body.prepend(row)
    if @_receipt.isActive()
      @_setSum(@_receipt.total)
    return row

  onAddItem: (code) =>
    if code.trim() == "" then return

    if not @_receipt.isActive()
      Api.item_find(code: code, available: true).then(
        () => @startReceipt(code)
        (jqXHR) => @showError(jqXHR.status, code)
      )
    else
      @reserveItem(code)

  showError: (status, code) =>
    switch status
      when 404 then alert("Item is not registered: " + code)
      when 409 then alert("Item state is not brought to event: " + code)
      when 423 then alert("Item state already staged: " + code)
      else alert("Error " + status + ": " + code)

  restoreReceipt: (receipt) ->
    @switcher.setMenuEnabled(false)
    Api.receipt_activate(id: receipt.id).then(
      (data) =>
        @_receipt.start(data)
        @_receipt.total = data.total

        @receipt.body.empty()
        for item in data.items
          price = if item.action == "DEL" then -item.price else item.price
          @addRow(item.code, item.name, price)
        @_setSum(@_receipt.total)

      () =>
        alert("Could not restore receipt!")
        @switcher.setMenuEnabled(true)
    )

  startReceipt: (code) ->
    @_receipt.start()

    # Changes to other modes now would result in fatal errors.
    @switcher.setMenuEnabled(false)

    Api.receipt_start().then(
      (data) =>
        @_receipt.data = data
        @receipt.body.empty()
        @_setSum()
        @reserveItem(code)

      (jqHXR) =>
        alert("Could not start receipt!")
        # Rollback.
        @_receipt.end()
        @switcher.setMenuEnabled(true)
        return true
    )

  _setSum: (sum=0, ret=null) ->
    text = "Total: " + (sum).formatCents() + " €"
    if ret?
      text += " / Return: " + (ret).formatCents() + " €"
    @receiptSum.set(text)
    @receiptSum.setEnabled(@_receipt.isActive())

  reserveItem: (code) ->
      Api.item_reserve(code: code).then(
        (data) =>
          @_receipt.total += data.price
          @addRow(data.code, data.name, data.price)
        (jqXHR) =>
          @showError(jqXHR.status, code)
          return true
      )

  onRemoveItem: (code) =>
    unless @_receipt.isActive() then return

    Api.item_release(code: code).then(
      (data) =>
        @_receipt.total -= data.price
        @addRow(data.code, data.name, -data.price)

      () =>
        alert("Item not found on receipt: " + code)
        return true
    )

  onPayReceipt: (input) =>
    unless Number.isConvertible(input) then return

    # If decimal separator is supplied, ensure dot and expect euros.
    input = input.replace(",", ".")
    if input.indexOf(".")
      # Euros.
      input = (input - 0) * 100
    else
      # Cents.
      input = input - 0

    if input < @_receipt.total
      alert("Not enough given money!")
      return

    if input > 400*100
      alert("Not accepting THAT much money!")
      return

    # Convert previous payment calculations from success -> info,muted
    @receipt.body.children(".receipt-ending").removeClass("success").addClass("info text-muted")

    # Add (new) payment calculation rows.
    return_amount = input - @_receipt.total
    row.addClass("success receipt-ending") for row in [
      @addRow(null, "Subtotal", @_receipt.total, true),
      @addRow(null, "Cash", input),
      @addRow(null, "Return", return_amount, true),
    ]

    # Also display the return amount in the top.
    @_setSum(@_receipt.total, return_amount.round5())

    # End receipt only if it has not been ended.
    unless @_receipt.isActive() then return
    Api.receipt_finish().then(
      (data) =>
        @_receipt.end(data)
        console.log(@_receipt)

        # Mode switching is safe to use again.
        @switcher.setMenuEnabled(true)
        @receiptSum.setEnabled(false)

      () =>
        alert("Error ending receipt!")
        return true
    )

  onAbortReceipt: =>
    unless @_receipt.isActive() then return

    Api.receipt_abort().then(
      (data) =>
        @_receipt.end(data)
        console.log(@_receipt)

        @addRow(null, "Aborted", null).addClass("danger")
        # Mode switching is safe to use again.
        @switcher.setMenuEnabled(true)
        @receiptSum.setEnabled(false)

      () =>
        alert("Error ending receipt!")
        return true
    )

  onLogout: =>
    if @_receipt.isActive()
      alert("Cannot logout while receipt is active!")
      return

    Api.clerk_logout().then(
      () =>
        console.log("Logged out #{ @cfg.settings.clerkName }.")
        @cfg.settings.clerkName = null
        @switcher.switchTo(ClerkLoginMode)

      () =>
        alert("Logout failed!")
        return true
    )


# Class for holding in some some of receipt information.
# @private
class ReceiptData
  constructor: ->
    @start(null)
    @active = false

  isActive: -> @active
  start: (data=null) ->
    @active = true
    @rowCount = 0
    @total = 0
    @data = data

  end: (data=null) ->
    @active = false
    @data = data

# Safely set or remove class to/from element.
#
# @param element [$] Element to adjust.
# @param cls [String] CSS Class name to adjust.
# @param enabled [Boolean] Whether the class should exist in the element.
# @return [$] The element.
@setClass = (element, cls, enabled) ->
  if element.hasClass(cls) != enabled
    if enabled
      element.addClass(cls)
    else
      element.removeClass(cls)
  return element

# Class for switching CheckoutModes.
class @ModeSwitcher

  # Map of entry point names to CheckoutModes.
  @entryPoints = {}

  # Register entry point with name.
  #
  # @param name [String] Name of the entry point.
  # @param mode [CheckoutMode] Entry point, CheckoutMode subclass.s
  @registerEntryPoint: (name, mode) ->
    if name of @entryPoints
      console.error("Name '#{ name }' was already registered for '#{ @entryPoints[name].name }' while registering '#{ mode.name }'.")
    else
      @entryPoints[name] = mode

  # @param config [Config, optional] Configuration instance override.
  constructor: (config) ->
    @cfg = if config then config else CheckoutConfig
    @_currentMode = null
    @_bindMenu(ModeSwitcher.entryPoints)
    @_bindForm()

    # Function for regaining focus after dialog closing.
    regainFocus = () =>
      timeoutFocus = () => @cfg.uiRef.codeInput.focus()
      # The actual focusing needs to be done after the event has been processed so that the focus can actually be set.
      setTimeout(timeoutFocus, 0)

    # Regain focus with both, template and help dialog.
    @cfg.uiRef.dialog.on("hidden.bs.modal", regainFocus)
    $("#help_dialog").on("hidden.bs.modal", regainFocus)

  # Start default mode operation.
  startDefault: ->
    @switchTo(ModeSwitcher.entryPoints["counter_validation"])

  # Switch to new mode. This is called by modes.
  #
  # @param mode [CheckoutMode, class] Class of new mode.
  # @param args... [] Arguments for the mode constructor.
  switchTo: (mode, params=null) ->
    if @_currentMode? then @_currentMode.exit()
    @setMenuEnabled(true)
    @_currentMode = new mode(@, @cfg, params)

    @cfg.uiRef.container.removeClass().addClass('container').addClass('color-mode')
    @cfg.uiRef.container.addClass('color-' + @_currentMode.constructor.name)
    @cfg.uiRef.body.empty()
    @cfg.uiRef.glyph.removeClass().addClass('glyphicon')
    if @_currentMode.glyph()
      @cfg.uiRef.glyph.addClass("glyphicon-" + @_currentMode.glyph())
      @cfg.uiRef.glyph.addClass("hidden-print")
    @cfg.uiRef.stateText.text(@_currentMode.title())
    @cfg.uiRef.subtitleText.text(@_currentMode.subtitle() or "")
    @cfg.uiRef.codeInput.attr("placeholder", @_currentMode.inputPlaceholder())
    @_currentMode.enter()

    # Restore focus to the input field after mode change.
    @cfg.uiRef.codeInput.focus()

  # Bind functions to HTML elements.
  _bindForm: ->
    form = @cfg.uiRef.codeForm
    form.off("submit")
    form.submit(@_onFormSubmit)

  _onFormSubmit: (event) =>
    event.preventDefault()
    input = @cfg.uiRef.codeInput.val()
    actions = @_currentMode.actions()

    # List of prefixes that match the input.
    matching = (a for a in actions when input.indexOf(a[0]) == 0)
    # Sort to longest first order.
    matching = matching.sort((a, b) -> b[0].length - a[0].length)

    if matching[0]?
      [prefix, handler] = matching[0]
      handler(input.slice(prefix.length), prefix)
      @cfg.uiRef.codeInput.val("")
    else
      console.error("Input not accepted: '#{input}'.")

  # Bind mode switching menu items.
  _bindMenu: (entryPoints) ->
    # For all menu-items that have data-entrypoint attribute defined, if the
    # name defined by that attribute is found in entryPoints, add
    # click-handler that will switch mode to the mode defined by the value in
    # entryPoints dictionary.
    menu = @cfg.uiRef.modeMenu
    items = menu.find("[data-entrypoint]")
    for itemDom in items
      item = $(itemDom)
      entryPointName = item.attr("data-entrypoint")
      if entryPointName of entryPoints
        entryPoint = entryPoints[entryPointName]

        # As entryPoint -variable is somehow shared across all iterations of
        # the for-loop, forcing own variable per iteration with extra function
        # wrap that is called immediately with current values.
        ((this_, ep) ->
          item.click(() ->
            console.log("Changing mode from menu to " + ep.name)
            this_.switchTo(ep)
          )
        )(@, entryPoint)
      else
        console.warn("Entry point '#{ entryPointName }' could not be found from registered entry points. Source:")
        console.log(itemDom)
    return

  # Enable or disable mode switching menu.
  #
  # @param enabled [Boolean] If true, menu will be enabled. If false, menu will be disabled.
  setMenuEnabled: (enabled) ->
    menu = @cfg.uiRef.modeMenu
    setClass(menu, "disabled", not enabled)
    setClass(menu.find("a:first"), "disabled", not enabled)

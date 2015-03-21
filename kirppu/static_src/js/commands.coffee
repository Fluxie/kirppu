@listCommands = (id) ->

  # Parse descriptions from every registered mode.
  codes = []
  codeSet = []
  for modeName, mode of ModeSwitcher.entryPoints
    mc = new mode().commandDescriptions
    for cKey, cDesc of mc
      code = cDesc[0]
      if code not in codeSet
        codes.push(cDesc)
        codeSet.push(code)

  # Generate item from template for every code previously found.
  generator = new Generator()
  out = []
  i = 0
  for desc in codes
    out.push(generator.barcode(desc[1], desc[0], i))
    i++

  # Determine repeat count.
  count = 1
  count_arg = /^#(\d+)$/.exec(window.location.hash)
  count = Math.max(1, count_arg[1] - 0) unless count_arg == null

  # Add first group of codes.
  $("#" + id).append(out)

  if count > 1
    # Output clones of the first clone and add separator between groups.
    source = $("#" + id).children()
    for _ in [1...count]
      $("#" + id).append(generator.separator.clone())
      $("#" + id).append(source.clone())

  # DOM is about ready. Get barcodes for the elements.
  Api.get_barcodes(codes: JSON.stringify(codeSet)).then(
    (codes) ->
      o = 0
      for code in codes
        elem = $(".cmd_bc_" + o)
        elem.attr("src", code)
        o++
      return
  )

class Generator
  constructor: ->
    @template = $("#item_template").children()
    @separator = $("#group_separator").children()

  barcode: (name, code, i) ->
    item = @template.clone()
    item.find('[data-id="name"]').text(name)
    item.find('[data-id="barcode"]').addClass("cmd_bc_#{i}")
    item.find('[data-id="barcode_text"]').text(code)
    return item

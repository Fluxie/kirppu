// ================ 1: commands.coffee ================

(function() {
  var Generator,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  this.listCommands = function(id) {
    var _, cDesc, cKey, code, codeSet, codes, count, count_arg, desc, generator, i, j, k, len, mc, mode, modeName, out, ref, ref1, source;
    codes = [];
    codeSet = [];
    ref = ModeSwitcher.entryPoints;
    for (modeName in ref) {
      mode = ref[modeName];
      mc = new mode().commandDescriptions;
      for (cKey in mc) {
        cDesc = mc[cKey];
        code = cDesc[0];
        if (indexOf.call(codeSet, code) < 0) {
          codes.push(cDesc);
          codeSet.push(code);
        }
      }
    }
    generator = new Generator();
    out = [];
    i = 0;
    for (j = 0, len = codes.length; j < len; j++) {
      desc = codes[j];
      out.push(generator.barcode(desc[1], desc[0], i));
      i++;
    }
    count = 1;
    count_arg = /^#(\d+)$/.exec(window.location.hash);
    if (count_arg !== null) {
      count = Math.max(1, count_arg[1] - 0);
    }
    $("#" + id).append(out);
    if (count > 1) {
      source = $("#" + id).children();
      for (_ = k = 1, ref1 = count; 1 <= ref1 ? k < ref1 : k > ref1; _ = 1 <= ref1 ? ++k : --k) {
        $("#" + id).append(generator.separator.clone());
        $("#" + id).append(source.clone());
      }
    }
    return Api.get_barcodes({
      codes: JSON.stringify(codeSet)
    }).then(function(codes) {
      var elem, l, len1, o;
      o = 0;
      for (l = 0, len1 = codes.length; l < len1; l++) {
        code = codes[l];
        elem = $(".cmd_bc_" + o);
        elem.attr("src", code);
        o++;
      }
    });
  };

  Generator = (function() {
    function Generator() {
      this.template = $("#item_template").children();
      this.separator = $("#group_separator").children();
    }

    Generator.prototype.barcode = function(name, code, i) {
      var item;
      item = this.template.clone();
      item.find('[data-id="name"]').text(name);
      item.find('[data-id="barcode"]').addClass("cmd_bc_" + i + " barcode_img_" + code.length + "_2");
      item.find('[data-id="barcode_container"]').addClass("barcode_container_" + code.length + "_2");
      item.find('[data-id="barcode_text"]').text(code);
      return item;
    };

    return Generator;

  })();

}).call(this);

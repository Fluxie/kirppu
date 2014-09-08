// Generated by CoffeeScript 1.7.1
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  this.VendorCheckoutMode = (function(_super) {
    __extends(VendorCheckoutMode, _super);

    ModeSwitcher.registerEntryPoint("vendor_check_out", VendorCheckoutMode);

    function VendorCheckoutMode(cfg, switcher, vendor) {
      this.onCheckedOut = __bind(this.onCheckedOut, this);
      this.onItemFound = __bind(this.onItemFound, this);
      this.returnItem = __bind(this.returnItem, this);
      VendorCheckoutMode.__super__.constructor.call(this, cfg, switcher);
      this.vendorId = vendor != null ? vendor.id : null;
    }

    VendorCheckoutMode.prototype.enter = function() {
      VendorCheckoutMode.__super__.enter.apply(this, arguments);
      if (this.vendorId != null) {
        return this.addVendorInfo();
      }
    };

    VendorCheckoutMode.prototype.title = function() {
      return "Vendor Check-Out";
    };

    VendorCheckoutMode.prototype.actions = function() {
      return [['', this.returnItem]];
    };

    VendorCheckoutMode.prototype.addVendorInfo = function() {
      return Api.vendor_get({
        id: this.vendorId
      }).done((function(_this) {
        return function(vendor) {
          _this.cfg.uiRef.body.prepend($('<input type="button">').addClass('btn btn-primary').attr('value', 'Open Report').click(function() {
            return _this.switcher.switchTo(VendorReport, vendor);
          }));
          return _this.cfg.uiRef.body.prepend(new VendorInfo(vendor).render());
        };
      })(this));
    };

    VendorCheckoutMode.prototype.returnItem = function(code) {
      return Api.item_find({
        code: code
      }).done(this.onItemFound);
    };

    VendorCheckoutMode.prototype.onItemFound = function(item) {
      if (this.vendorId == null) {
        this.vendorId = item.vendor;
        this.addVendorInfo();
      } else if (this.vendorId !== item.vendor) {
        alert('Someone else\'s item!');
        return;
      }
      return Api.item_checkout({
        code: item.code
      }).done(this.onCheckedOut);
    };

    VendorCheckoutMode.prototype.onCheckedOut = function(item) {
      var row;
      row = this.createRow("", item.code, item.name, item.price);
      return this.receipt.body.prepend(row);
    };

    return VendorCheckoutMode;

  })(ItemCheckoutMode);

}).call(this);
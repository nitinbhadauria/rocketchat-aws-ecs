(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var check = Package.check.check;
var Match = Package.check.Match;
var CollectionHooks = Package['matb33:collection-hooks'].CollectionHooks;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var __coffeescriptShare;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/todda00_friendly-slugs/slugs.coffee                                                                    //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Mongo, slugify, stringToNested;

if (typeof Mongo === "undefined") {
  Mongo = {};
  Mongo.Collection = Meteor.Collection;
}

Mongo.Collection.prototype.friendlySlugs = function (options) {
  var collection, fsDebug, runSlug;

  if (options == null) {
    options = {};
  }

  collection = this;

  if (!_.isArray(options)) {
    options = [options];
  }

  _.each(options, function (opts) {
    var defaults, fields;

    if (_.isString(opts)) {
      opts = {
        slugFrom: [opts]
      };
    }

    if (_.isString(opts.slugFrom)) {
      opts.slugFrom = [opts.slugFrom];
    }

    defaults = {
      slugFrom: ['name'],
      slugField: 'slug',
      distinct: true,
      distinctUpTo: [],
      updateSlug: true,
      createOnUpdate: true,
      maxLength: 0,
      debug: false,
      transliteration: [{
        from: 'àáâäåãа',
        to: 'a'
      }, {
        from: 'б',
        to: 'b'
      }, {
        from: 'ç',
        to: 'c'
      }, {
        from: 'д',
        to: 'd'
      }, {
        from: 'èéêëẽэе',
        to: 'e'
      }, {
        from: 'ф',
        to: 'f'
      }, {
        from: 'г',
        to: 'g'
      }, {
        from: 'х',
        to: 'h'
      }, {
        from: 'ìíîïи',
        to: 'i'
      }, {
        from: 'к',
        to: 'k'
      }, {
        from: 'л',
        to: 'l'
      }, {
        from: 'м',
        to: 'm'
      }, {
        from: 'ñн',
        to: 'n'
      }, {
        from: 'òóôöõо',
        to: 'o'
      }, {
        from: 'п',
        to: 'p'
      }, {
        from: 'р',
        to: 'r'
      }, {
        from: 'с',
        to: 's'
      }, {
        from: 'т',
        to: 't'
      }, {
        from: 'ùúûüу',
        to: 'u'
      }, {
        from: 'в',
        to: 'v'
      }, {
        from: 'йы',
        to: 'y'
      }, {
        from: 'з',
        to: 'z'
      }, {
        from: 'æ',
        to: 'ae'
      }, {
        from: 'ч',
        to: 'ch'
      }, {
        from: 'щ',
        to: 'sch'
      }, {
        from: 'ш',
        to: 'sh'
      }, {
        from: 'ц',
        to: 'ts'
      }, {
        from: 'я',
        to: 'ya'
      }, {
        from: 'ю',
        to: 'yu'
      }, {
        from: 'ж',
        to: 'zh'
      }, {
        from: 'ъь',
        to: ''
      }]
    };

    _.defaults(opts, defaults);

    fields = {
      slugFrom: Array,
      slugField: String,
      distinct: Boolean,
      createOnUpdate: Boolean,
      maxLength: Number,
      debug: Boolean
    };

    if (typeof opts.updateSlug !== "function") {
      if (opts.updateSlug) {
        opts.updateSlug = function () {
          return true;
        };
      } else {
        opts.updateSlug = function () {
          return false;
        };
      }
    }

    check(opts, Match.ObjectIncluding(fields));
    collection.before.insert(function (userId, doc) {
      fsDebug(opts, 'before.insert function');
      runSlug(doc, opts);
    });
    collection.before.update(function (userId, doc, fieldNames, modifier, options) {
      var cleanModifier, cont, slugFromChanged;
      fsDebug(opts, 'before.update function');

      cleanModifier = function () {
        if (_.isEmpty(modifier.$set)) {
          return delete modifier.$set;
        }
      };

      options = options || {};

      if (options.multi) {
        fsDebug(opts, "multi doc update attempted, can't update slugs this way, leaving.");
        return true;
      }

      modifier = modifier || {};
      modifier.$set = modifier.$set || {};
      cont = false;

      _.each(opts.slugFrom, function (slugFrom) {
        if (stringToNested(doc, slugFrom) || modifier.$set[slugFrom] != null || stringToNested(modifier.$set, slugFrom)) {
          return cont = true;
        }
      });

      if (!cont) {
        fsDebug(opts, "no slugFrom fields are present (either before or after update), leaving.");
        cleanModifier();
        return true;
      }

      slugFromChanged = false;

      _.each(opts.slugFrom, function (slugFrom) {
        var docFrom;

        if (modifier.$set[slugFrom] != null || stringToNested(modifier.$set, slugFrom)) {
          docFrom = stringToNested(doc, slugFrom);

          if (docFrom !== modifier.$set[slugFrom] && docFrom !== stringToNested(modifier.$set, slugFrom)) {
            return slugFromChanged = true;
          }
        }
      });

      fsDebug(opts, slugFromChanged, 'slugFromChanged');

      if (!stringToNested(doc, opts.slugField) && opts.createOnUpdate) {
        fsDebug(opts, 'Update: Slug Field is missing and createOnUpdate is set to true');

        if (slugFromChanged) {
          fsDebug(opts, 'slugFrom field has changed, runSlug with modifier');
          runSlug(doc, opts, modifier);
        } else {
          fsDebug(opts, 'runSlug to create');
          runSlug(doc, opts, modifier, true);
          cleanModifier();
          return true;
        }
      } else {
        if ((typeof opts.updateSlug === "function" ? opts.updateSlug(doc, modifier) : void 0) === false) {
          fsDebug(opts, 'updateSlug is false, nothing to do.');
          cleanModifier();
          return true;
        }

        if (!slugFromChanged) {
          fsDebug(opts, 'slugFrom field has not changed, nothing to do.');
          cleanModifier();
          return true;
        }

        runSlug(doc, opts, modifier);
        cleanModifier();
        return true;
      }

      cleanModifier();
      return true;
    });
  });

  runSlug = function (doc, opts, modifier, create) {
    var baseField, combineFrom, defaultSlugGenerator, f, fieldSelector, finalSlug, from, i, index, indexField, limitSelector, ref, result, slugBase, slugGenerator, sortSelector;

    if (modifier == null) {
      modifier = false;
    }

    if (create == null) {
      create = false;
    }

    fsDebug(opts, 'Begin runSlug');
    fsDebug(opts, opts, 'Options');
    fsDebug(opts, modifier, 'Modifier');
    fsDebug(opts, create, 'Create');

    combineFrom = function (doc, fields, modifierDoc) {
      var fromValues;
      fromValues = [];

      _.each(fields, function (f) {
        var val;

        if (modifierDoc != null) {
          if (stringToNested(modifierDoc, f)) {
            val = stringToNested(modifierDoc, f);
          } else {
            val = stringToNested(doc, f);
          }
        } else {
          val = stringToNested(doc, f);
        }

        if (val) {
          return fromValues.push(val);
        }
      });

      if (fromValues.length === 0) {
        return false;
      }

      return fromValues.join('-');
    };

    from = create || !modifier ? combineFrom(doc, opts.slugFrom) : combineFrom(doc, opts.slugFrom, modifier.$set);

    if (from === false) {
      fsDebug(opts, "Nothing to slug from, leaving.");
      return true;
    }

    fsDebug(opts, from, 'Slugging From');
    slugBase = slugify(from, opts.transliteration, opts.maxLength);

    if (!slugBase) {
      return false;
    }

    fsDebug(opts, slugBase, 'SlugBase before reduction');

    if (opts.distinct) {
      slugBase = slugBase.replace(/(-\d+)+$/, '');
      fsDebug(opts, slugBase, 'SlugBase after reduction');
      baseField = "friendlySlugs." + opts.slugField + ".base";
      indexField = "friendlySlugs." + opts.slugField + ".index";
      fieldSelector = {};
      fieldSelector[baseField] = slugBase;
      i = 0;

      while (i < opts.distinctUpTo.length) {
        f = opts.distinctUpTo[i];
        fieldSelector[f] = doc[f];
        i++;
      }

      sortSelector = {};
      sortSelector[indexField] = -1;
      limitSelector = {};
      limitSelector[indexField] = 1;
      result = collection.findOne(fieldSelector, {
        sort: sortSelector,
        fields: limitSelector,
        limit: 1
      });
      fsDebug(opts, result, 'Highest indexed base found');

      if (result == null || result.friendlySlugs == null || result.friendlySlugs[opts.slugField] == null || result.friendlySlugs[opts.slugField].index == null) {
        index = 0;
      } else {
        index = result.friendlySlugs[opts.slugField].index + 1;
      }

      defaultSlugGenerator = function (slugBase, index) {
        if (index === 0) {
          return slugBase;
        } else {
          return slugBase + '-' + index;
        }
      };

      slugGenerator = (ref = opts.slugGenerator) != null ? ref : defaultSlugGenerator;
      finalSlug = slugGenerator(slugBase, index);
    } else {
      index = false;
      finalSlug = slugBase;
    }

    fsDebug(opts, finalSlug, 'finalSlug');

    if (modifier || create) {
      fsDebug(opts, 'Set to modify or create slug on update');
      modifier = modifier || {};
      modifier.$set = modifier.$set || {};
      modifier.$set.friendlySlugs = doc.friendlySlugs || {};
      modifier.$set.friendlySlugs[opts.slugField] = modifier.$set.friendlySlugs[opts.slugField] || {};
      modifier.$set.friendlySlugs[opts.slugField].base = slugBase;
      modifier.$set.friendlySlugs[opts.slugField].index = index;
      modifier.$set[opts.slugField] = finalSlug;
      fsDebug(opts, modifier, 'Final Modifier');
    } else {
      fsDebug(opts, 'Set to update');
      doc.friendlySlugs = doc.friendlySlugs || {};
      doc.friendlySlugs[opts.slugField] = doc.friendlySlugs[opts.slugField] || {};
      doc.friendlySlugs[opts.slugField].base = slugBase;
      doc.friendlySlugs[opts.slugField].index = index;
      doc[opts.slugField] = finalSlug;
      fsDebug(opts, doc, 'Final Doc');
    }

    return true;
  };

  return fsDebug = function (opts, item, label) {
    if (label == null) {
      label = '';
    }

    if (!opts.debug) {
      return;
    }

    if ((typeof item === "undefined" ? "undefined" : _typeof(item)) === 'object') {
      console.log("friendlySlugs DEBUG: " + label + '↓');
      return console.log(item);
    } else {
      return console.log("friendlySlugs DEBUG: " + label + '= ' + item);
    }
  };
};

slugify = function (text, transliteration, maxLength) {
  var lastDash, slug;

  if (text == null) {
    return false;
  }

  if (text.length < 1) {
    return false;
  }

  text = text.toString().toLowerCase();

  _.each(transliteration, function (item) {
    return text = text.replace(new RegExp('[' + item.from + ']', 'g'), item.to);
  });

  slug = text.replace(/'/g, '').replace(/[^0-9a-z-]/g, '-').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

  if (maxLength > 0 && slug.length > maxLength) {
    lastDash = slug.substring(0, maxLength).lastIndexOf('-');
    slug = slug.substring(0, lastDash);
  }

  return slug;
};

stringToNested = function (obj, path) {
  var parts;
  parts = path.split(".");

  if (parts.length === 1) {
    if (obj != null && obj[parts[0]] != null) {
      return obj[parts[0]];
    } else {
      return false;
    }
  }

  return stringToNested(obj[parts[0]], parts.slice(1).join("."));
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['todda00:friendly-slugs'] = {};

})();

//# sourceURL=meteor://💻app/packages/todda00_friendly-slugs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvdG9kZGEwMF9mcmllbmRseS1zbHVncy9zbHVncy5jb2ZmZWUiLCJtZXRlb3I6Ly/wn5K7YXBwL3NsdWdzLmNvZmZlZSJdLCJuYW1lcyI6WyJNb25nbyIsInNsdWdpZnkiLCJzdHJpbmdUb05lc3RlZCIsIkNvbGxlY3Rpb24iLCJNZXRlb3IiLCJwcm90b3R5cGUiLCJmcmllbmRseVNsdWdzIiwib3B0aW9ucyIsImNvbGxlY3Rpb24iLCJmc0RlYnVnIiwicnVuU2x1ZyIsIl8iLCJpc0FycmF5IiwiZWFjaCIsIm9wdHMiLCJkZWZhdWx0cyIsImZpZWxkcyIsImlzU3RyaW5nIiwic2x1Z0Zyb20iLCJzbHVnRmllbGQiLCJkaXN0aW5jdCIsImRpc3RpbmN0VXBUbyIsInVwZGF0ZVNsdWciLCJjcmVhdGVPblVwZGF0ZSIsIm1heExlbmd0aCIsImRlYnVnIiwidHJhbnNsaXRlcmF0aW9uIiwiZnJvbSIsInRvIiwiQXJyYXkiLCJTdHJpbmciLCJCb29sZWFuIiwiTnVtYmVyIiwiY2hlY2siLCJNYXRjaCIsIk9iamVjdEluY2x1ZGluZyIsImJlZm9yZSIsImluc2VydCIsInVzZXJJZCIsImRvYyIsInVwZGF0ZSIsImZpZWxkTmFtZXMiLCJtb2RpZmllciIsImNsZWFuTW9kaWZpZXIiLCJjb250Iiwic2x1Z0Zyb21DaGFuZ2VkIiwiaXNFbXB0eSIsIiRzZXQiLCJtdWx0aSIsImRvY0Zyb20iLCJjcmVhdGUiLCJiYXNlRmllbGQiLCJjb21iaW5lRnJvbSIsImRlZmF1bHRTbHVnR2VuZXJhdG9yIiwiZiIsImZpZWxkU2VsZWN0b3IiLCJmaW5hbFNsdWciLCJpIiwiaW5kZXgiLCJpbmRleEZpZWxkIiwibGltaXRTZWxlY3RvciIsInJlZiIsInJlc3VsdCIsInNsdWdCYXNlIiwic2x1Z0dlbmVyYXRvciIsInNvcnRTZWxlY3RvciIsIm1vZGlmaWVyRG9jIiwiZnJvbVZhbHVlcyIsInZhbCIsInB1c2giLCJsZW5ndGgiLCJqb2luIiwicmVwbGFjZSIsImZpbmRPbmUiLCJzb3J0IiwibGltaXQiLCJiYXNlIiwiaXRlbSIsImxhYmVsIiwiY29uc29sZSIsImxvZyIsInRleHQiLCJsYXN0RGFzaCIsInNsdWciLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiUmVnRXhwIiwic3Vic3RyaW5nIiwibGFzdEluZGV4T2YiLCJvYmoiLCJwYXRoIiwicGFydHMiLCJzcGxpdCIsInNsaWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxJQUFBQSxLQUFBLEVBQUFDLE9BQUEsRUFBQUMsY0FBQTs7QUFBQSxJQUFHLE9BQU9GLEtBQVAsS0FBZ0IsV0FBbkI7QUFDRUEsVUFBUSxFQUFSO0FBQ0FBLFFBQU1HLFVBQU4sR0FBbUJDLE9BQU9ELFVBQTFCO0FDRUQ7O0FEQURILE1BQU1HLFVBQU4sQ0FBaUJFLFNBQWpCLENBQTJCQyxhQUEzQixHQUEyQyxVQUFDQyxPQUFEO0FBQ3pDLE1BQUFDLFVBQUEsRUFBQUMsT0FBQSxFQUFBQyxPQUFBOztBQ0dBLE1BQUlILFdBQVcsSUFBZixFQUFxQjtBREpxQkEsY0FBVSxFQUFWO0FDTXpDOztBRExEQyxlQUFhLElBQWI7O0FBRUEsTUFBRyxDQUFDRyxFQUFFQyxPQUFGLENBQVVMLE9BQVYsQ0FBSjtBQUNFQSxjQUFVLENBQUNBLE9BQUQsQ0FBVjtBQ01EOztBREpESSxJQUFFRSxJQUFGLENBQU9OLE9BQVAsRUFBZ0IsVUFBQ08sSUFBRDtBQUNkLFFBQUFDLFFBQUEsRUFBQUMsTUFBQTs7QUFBQSxRQUFHTCxFQUFFTSxRQUFGLENBQVdILElBQVgsQ0FBSDtBQUNFQSxhQUFPO0FBQ0xJLGtCQUFVLENBQUNKLElBQUQ7QUFETCxPQUFQO0FDU0Q7O0FETkQsUUFBbUNILEVBQUVNLFFBQUYsQ0FBV0gsS0FBS0ksUUFBaEIsQ0FBbkM7QUFBQUosV0FBS0ksUUFBTCxHQUFnQixDQUFDSixLQUFLSSxRQUFOLENBQWhCO0FDU0M7O0FEUERILGVBQ0U7QUFBQUcsZ0JBQVUsQ0FBQyxN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Q0FBSixDQUFQO0FBREY7QUFHRSxhQUFPLEtBQVA7QUFKSjtBQzRGQzs7QUR2RkQsU0FBT3pGLGVBQWV1RixJQUFJRSxNQUFNLENBQU4sQ0FBSixDQUFmLEVBQThCQSxNQUFNRSxLQUFOLENBQVksQ0FBWixFQUFldEIsSUFBZixDQUFvQixHQUFwQixDQUE5QixDQUFQO0FBUGUsQ0FBakIsQyIsImZpbGUiOiIvcGFja2FnZXMvdG9kZGEwMF9mcmllbmRseS1zbHVncy5qcyIsInNvdXJjZXNDb250ZW50IjpbIiMgYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbmlmIHR5cGVvZiBNb25nbyBpcyBcInVuZGVmaW5lZFwiXG4gIE1vbmdvID0ge31cbiAgTW9uZ28uQ29sbGVjdGlvbiA9IE1ldGVvci5Db2xsZWN0aW9uXG5cbk1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLmZyaWVuZGx5U2x1Z3MgPSAob3B0aW9ucyA9IHt9KSAtPlxuICBjb2xsZWN0aW9uID0gQFxuXG4gIGlmICFfLmlzQXJyYXkob3B0aW9ucylcbiAgICBvcHRpb25zID0gW29wdGlvbnNdXG5cbiAgXy5lYWNoIG9wdGlvbnMsIChvcHRzKSAtPlxuICAgIGlmIF8uaXNTdHJpbmcob3B0cylcbiAgICAgIG9wdHMgPSB7XG4gICAgICAgIHNsdWdGcm9tOiBbb3B0c11cbiAgICAgIH1cbiAgICBvcHRzLnNsdWdGcm9tID0gW29wdHMuc2x1Z0Zyb21dIGlmIF8uaXNTdHJpbmcgb3B0cy5zbHVnRnJvbVxuXG4gICAgZGVmYXVsdHMgPVxuICAgICAgc2x1Z0Zyb206IFsnbmFtZSddXG4gICAgICBzbHVnRmllbGQ6ICdzbHVnJ1xuICAgICAgZGlzdGluY3Q6IHRydWVcbiAgICAgIGRpc3RpbmN0VXBUbzogW11cbiAgICAgIHVwZGF0ZVNsdWc6IHRydWVcbiAgICAgIGNyZWF0ZU9uVXBkYXRlOiB0cnVlXG4gICAgICBtYXhMZW5ndGg6IDBcbiAgICAgIGRlYnVnOiBmYWxzZVxuICAgICAgdHJhbnNsaXRlcmF0aW9uOiBbXG4gICAgICAgIHtmcm9tOiAnw6DDocOiw6TDpcOj0LAnLCB0bzogJ2EnfVxuICAgICAgICB7ZnJvbTogJ9CxJywgICAgICB0bzogJ2InfVxuICAgICAgICB7ZnJvbTogJ8OnJywgICAgICB0bzogJ2MnfVxuICAgICAgICB7ZnJvbTogJ9C0JywgICAgICB0bzogJ2QnfVxuICAgICAgICB7ZnJvbTogJ8Oow6nDqsOr4bq90Y3QtScsdG86ICdlJ31cbiAgICAgICAge2Zyb206ICfRhCcsICAgICAgdG86ICdmJ31cbiAgICAgICAge2Zyb206ICfQsycsICAgICAgdG86ICdnJ31cbiAgICAgICAge2Zyb206ICfRhScsICAgICAgdG86ICdoJ31cbiAgICAgICAge2Zyb206ICfDrMOtw67Dr9C4JywgIHRvOiAnaSd9XG4gICAgICAgIHtmcm9tOiAn0LonLCAgICAgIHRvOiAnayd9XG4gICAgICAgIHtmcm9tOiAn0LsnLCAgICAgIHRvOiAnbCd9XG4gICAgICAgIHtmcm9tOiAn0LwnLCAgICAgIHRvOiAnbSd9XG4gICAgICAgIHtmcm9tOiAnw7HQvScsICAgICB0bzogJ24nfVxuICAgICAgICB7ZnJvbTogJ8Oyw7PDtMO2w7XQvicsIHRvOiAnbyd9XG4gICAgICAgIHtmcm9tOiAn0L8nLCAgICAgIHRvOiAncCd9XG4gICAgICAgIHtmcm9tOiAn0YAnLCAgICAgIHRvOiAncid9XG4gICAgICAgIHtmcm9tOiAn0YEnLCAgICAgIHRvOiAncyd9XG4gICAgICAgIHtmcm9tOiAn0YInLCAgICAgIHRvOiAndCd9XG4gICAgICAgIHtmcm9tOiAnw7nDusO7w7zRgycsICB0bzogJ3UnfVxuICAgICAgICB7ZnJvbTogJ9CyJywgICAgICB0bzogJ3YnfVxuICAgICAgICB7ZnJvbTogJ9C50YsnLCAgICAgdG86ICd5J31cbiAgICAgICAge2Zyb206ICfQtycsICAgICAgdG86ICd6J31cbiAgICAgICAge2Zyb206ICfDpicsICAgICAgdG86ICdhZSd9XG4gICAgICAgIHtmcm9tOiAn0YcnLCAgICAgIHRvOiAnY2gnfVxuICAgICAgICB7ZnJvbTogJ9GJJywgICAgICB0bzogJ3NjaCd9XG4gICAgICAgIHtmcm9tOiAn0YgnLCAgICAgIHRvOiAnc2gnfVxuICAgICAgICB7ZnJvbTogJ9GGJywgICAgICB0bzogJ3RzJ31cbiAgICAgICAge2Zyb206ICfRjycsICAgICAgdG86ICd5YSd9XG4gICAgICAgIHtmcm9tOiAn0Y4nLCAgICAgIHRvOiAneXUnfVxuICAgICAgICB7ZnJvbTogJ9C2JywgICAgICB0bzogJ3poJ31cbiAgICAgICAge2Zyb206ICfRitGMJywgICAgIHRvOiAnJ31cbiAgICAgIF1cblxuICAgIF8uZGVmYXVsdHMob3B0cywgZGVmYXVsdHMpXG5cbiAgICBmaWVsZHMgPVxuICAgICAgc2x1Z0Zyb206IEFycmF5XG4gICAgICBzbHVnRmllbGQ6IFN0cmluZ1xuICAgICAgZGlzdGluY3Q6IEJvb2xlYW5cbiAgICAgIGNyZWF0ZU9uVXBkYXRlOiBCb29sZWFuXG4gICAgICBtYXhMZW5ndGg6IE51bWJlclxuICAgICAgZGVidWc6IEJvb2xlYW5cblxuICAgIGlmIHR5cGVvZiBvcHRzLnVwZGF0ZVNsdWcgIT0gXCJmdW5jdGlvblwiXG4gICAgICBpZiAob3B0cy51cGRhdGVTbHVnKVxuICAgICAgICBvcHRzLnVwZGF0ZVNsdWcgPSAoKSAtPiB0cnVlXG4gICAgICBlbHNlXG4gICAgICAgIG9wdHMudXBkYXRlU2x1ZyA9ICgpIC0+IGZhbHNlXG5cblxuICAgIGNoZWNrKG9wdHMsTWF0Y2guT2JqZWN0SW5jbHVkaW5nKGZpZWxkcykpXG5cbiAgICBjb2xsZWN0aW9uLmJlZm9yZS5pbnNlcnQgKHVzZXJJZCwgZG9jKSAtPlxuICAgICAgZnNEZWJ1ZyhvcHRzLCdiZWZvcmUuaW5zZXJ0IGZ1bmN0aW9uJylcbiAgICAgIHJ1blNsdWcoZG9jLG9wdHMpXG4gICAgICByZXR1cm5cblxuICAgIGNvbGxlY3Rpb24uYmVmb3JlLnVwZGF0ZSAodXNlcklkLCBkb2MsIGZpZWxkTmFtZXMsIG1vZGlmaWVyLCBvcHRpb25zKSAtPlxuICAgICAgZnNEZWJ1ZyhvcHRzLCdiZWZvcmUudXBkYXRlIGZ1bmN0aW9uJylcbiAgICAgIGNsZWFuTW9kaWZpZXIgPSAoKSAtPlxuICAgICAgICAjQ2xlYW51cCB0aGUgbW9kaWZpZXIgaWYgbmVlZGVkXG4gICAgICAgIGRlbGV0ZSBtb2RpZmllci4kc2V0IGlmIF8uaXNFbXB0eShtb2RpZmllci4kc2V0KVxuXG4gICAgICAjRG9uJ3QgZG8gYW55dGhpbmcgaWYgdGhpcyBpcyBhIG11bHRpIGRvYyB1cGRhdGVcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgICBpZiBvcHRpb25zLm11bHRpXG4gICAgICAgIGZzRGVidWcob3B0cyxcIm11bHRpIGRvYyB1cGRhdGUgYXR0ZW1wdGVkLCBjYW4ndCB1cGRhdGUgc2x1Z3MgdGhpcyB3YXksIGxlYXZpbmcuXCIpXG4gICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgIG1vZGlmaWVyID0gbW9kaWZpZXIgfHwge31cbiAgICAgIG1vZGlmaWVyLiRzZXQgPSBtb2RpZmllci4kc2V0IHx8IHt9XG5cbiAgICAgICNEb24ndCBkbyBhbnl0aGluZyBpZiBhbGwgdGhlIHNsdWdGcm9tIGZpZWxkcyBhcmVuJ3QgcHJlc2VudCAoYmVmb3JlIG9yIGFmdGVyIHVwZGF0ZSlcbiAgICAgIGNvbnQgPSBmYWxzZVxuICAgICAgXy5lYWNoIG9wdHMuc2x1Z0Zyb20sIChzbHVnRnJvbSkgLT5cbiAgICAgICAgY29udCA9IHRydWUgaWYgc3RyaW5nVG9OZXN0ZWQoZG9jLCBzbHVnRnJvbSkgfHwgbW9kaWZpZXIuJHNldFtzbHVnRnJvbV0/IHx8IHN0cmluZ1RvTmVzdGVkKG1vZGlmaWVyLiRzZXQsIHNsdWdGcm9tKVxuICAgICAgaWYgIWNvbnRcbiAgICAgICAgZnNEZWJ1ZyhvcHRzLFwibm8gc2x1Z0Zyb20gZmllbGRzIGFyZSBwcmVzZW50IChlaXRoZXIgYmVmb3JlIG9yIGFmdGVyIHVwZGF0ZSksIGxlYXZpbmcuXCIpXG4gICAgICAgIGNsZWFuTW9kaWZpZXIoKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuXG4gICAgICAjU2VlIGlmIGFueSBvZiB0aGUgc2x1Z0Zyb20gZmllbGRzIGhhdmUgY2hhbmdlZFxuICAgICAgc2x1Z0Zyb21DaGFuZ2VkID0gZmFsc2VcbiAgICAgIF8uZWFjaCBvcHRzLnNsdWdGcm9tLCAoc2x1Z0Zyb20pIC0+XG4gICAgICAgIGlmIG1vZGlmaWVyLiRzZXRbc2x1Z0Zyb21dPyB8fCBzdHJpbmdUb05lc3RlZChtb2RpZmllci4kc2V0LCBzbHVnRnJvbSlcbiAgICAgICAgICBkb2NGcm9tID0gc3RyaW5nVG9OZXN0ZWQoZG9jLCBzbHVnRnJvbSlcbiAgICAgICAgICBpZiAoZG9jRnJvbSBpc250IG1vZGlmaWVyLiRzZXRbc2x1Z0Zyb21dKSBhbmQgKGRvY0Zyb20gaXNudCBzdHJpbmdUb05lc3RlZChtb2RpZmllci4kc2V0LCBzbHVnRnJvbSkpXG4gICAgICAgICAgICBzbHVnRnJvbUNoYW5nZWQgPSB0cnVlXG5cbiAgICAgIGZzRGVidWcob3B0cyxzbHVnRnJvbUNoYW5nZWQsJ3NsdWdGcm9tQ2hhbmdlZCcpXG5cbiAgICAgICNJcyB0aGUgc2x1ZyBtaXNzaW5nIC8gSXMgdGhpcyBhbiBleGlzdGluZyBpdGVtIHdlIGhhdmUgYWRkZWQgYSBzbHVnIHRvPyBBTkQgYXJlIHdlIHN1cHBvc2VkIHRvIGNyZWF0ZSBhIHNsdWcgb24gdXBkYXRlP1xuICAgICAgaWYgIXN0cmluZ1RvTmVzdGVkKGRvYywgb3B0cy5zbHVnRmllbGQpIGFuZCBvcHRzLmNyZWF0ZU9uVXBkYXRlXG4gICAgICAgIGZzRGVidWcob3B0cywnVXBkYXRlOiBTbHVnIEZpZWxkIGlzIG1pc3NpbmcgYW5kIGNyZWF0ZU9uVXBkYXRlIGlzIHNldCB0byB0cnVlJylcblxuICAgICAgICBpZiBzbHVnRnJvbUNoYW5nZWRcbiAgICAgICAgICBmc0RlYnVnKG9wdHMsJ3NsdWdGcm9tIGZpZWxkIGhhcyBjaGFuZ2VkLCBydW5TbHVnIHdpdGggbW9kaWZpZXInKVxuICAgICAgICAgIHJ1blNsdWcoZG9jLCBvcHRzLCBtb2RpZmllcilcbiAgICAgICAgZWxzZVxuICAgICAgICAgICNSdW4gdGhlIHNsdWcgdG8gY3JlYXRlXG4gICAgICAgICAgZnNEZWJ1ZyhvcHRzLCdydW5TbHVnIHRvIGNyZWF0ZScpXG4gICAgICAgICAgcnVuU2x1Zyhkb2MsIG9wdHMsIG1vZGlmaWVyLCB0cnVlKVxuICAgICAgICAgIGNsZWFuTW9kaWZpZXIoKVxuICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgIGVsc2VcbiAgICAgICAgIyBEb24ndCBjaGFuZ2UgYW55dGhpbmcgb24gdXBkYXRlIGlmIHVwZGF0ZVNsdWcgaXMgZmFsc2VcbiAgICAgICAgaWYgb3B0cy51cGRhdGVTbHVnPyhkb2MsIG1vZGlmaWVyKSBpcyBmYWxzZVxuICAgICAgICAgIGZzRGVidWcob3B0cywndXBkYXRlU2x1ZyBpcyBmYWxzZSwgbm90aGluZyB0byBkby4nKVxuICAgICAgICAgIGNsZWFuTW9kaWZpZXIoKVxuICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgICAgI0Rvbid0IGRvIGFueXRoaW5nIGlmIHRoZSBzbHVnIGZyb20gZmllbGQgaGFzIG5vdCBjaGFuZ2VkXG4gICAgICAgIGlmICFzbHVnRnJvbUNoYW5nZWRcbiAgICAgICAgICBmc0RlYnVnKG9wdHMsJ3NsdWdGcm9tIGZpZWxkIGhhcyBub3QgY2hhbmdlZCwgbm90aGluZyB0byBkby4nKVxuICAgICAgICAgIGNsZWFuTW9kaWZpZXIoKVxuICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgICAgcnVuU2x1Zyhkb2MsIG9wdHMsIG1vZGlmaWVyKVxuXG4gICAgICAgIGNsZWFuTW9kaWZpZXIoKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuXG4gICAgICBjbGVhbk1vZGlmaWVyKClcbiAgICAgIHJldHVybiB0cnVlXG4gICAgcmV0dXJuXG4gIHJ1blNsdWcgPSAoZG9jLCBvcHRzLCBtb2RpZmllciA9IGZhbHNlLCBjcmVhdGUgPSBmYWxzZSkgLT5cbiAgICBmc0RlYnVnKG9wdHMsJ0JlZ2luIHJ1blNsdWcnKVxuICAgIGZzRGVidWcob3B0cyxvcHRzLCdPcHRpb25zJylcbiAgICBmc0RlYnVnKG9wdHMsbW9kaWZpZXIsICdNb2RpZmllcicpXG4gICAgZnNEZWJ1ZyhvcHRzLGNyZWF0ZSwnQ3JlYXRlJylcblxuICAgIGNvbWJpbmVGcm9tID0gKGRvYywgZmllbGRzLCBtb2RpZmllckRvYykgLT5cbiAgICAgIGZyb21WYWx1ZXMgPSBbXVxuICAgICAgXy5lYWNoIGZpZWxkcywgKGYpIC0+XG4gICAgICAgIGlmIG1vZGlmaWVyRG9jP1xuICAgICAgICAgIGlmIHN0cmluZ1RvTmVzdGVkKG1vZGlmaWVyRG9jLCBmKVxuICAgICAgICAgICAgdmFsID0gc3RyaW5nVG9OZXN0ZWQobW9kaWZpZXJEb2MsIGYpXG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdmFsID0gc3RyaW5nVG9OZXN0ZWQoZG9jLCBmKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdmFsID0gc3RyaW5nVG9OZXN0ZWQoZG9jLCBmKVxuICAgICAgICBmcm9tVmFsdWVzLnB1c2godmFsKSBpZiB2YWxcbiAgICAgIHJldHVybiBmYWxzZSBpZiBmcm9tVmFsdWVzLmxlbmd0aCA9PSAwXG4gICAgICByZXR1cm4gZnJvbVZhbHVlcy5qb2luKCctJylcblxuICAgIGZyb20gPSBpZiBjcmVhdGUgb3IgIW1vZGlmaWVyIHRoZW4gY29tYmluZUZyb20oZG9jLCBvcHRzLnNsdWdGcm9tKSBlbHNlIGNvbWJpbmVGcm9tKGRvYywgb3B0cy5zbHVnRnJvbSwgbW9kaWZpZXIuJHNldClcblxuICAgIGlmIGZyb20gPT0gZmFsc2VcbiAgICAgIGZzRGVidWcob3B0cyxcIk5vdGhpbmcgdG8gc2x1ZyBmcm9tLCBsZWF2aW5nLlwiKVxuICAgICAgcmV0dXJuIHRydWVcblxuICAgIGZzRGVidWcob3B0cyxmcm9tLCdTbHVnZ2luZyBGcm9tJylcblxuICAgIHNsdWdCYXNlID0gc2x1Z2lmeShmcm9tLCBvcHRzLnRyYW5zbGl0ZXJhdGlvbiwgb3B0cy5tYXhMZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlIGlmICFzbHVnQmFzZVxuXG4gICAgZnNEZWJ1ZyhvcHRzLHNsdWdCYXNlLCdTbHVnQmFzZSBiZWZvcmUgcmVkdWN0aW9uJylcblxuICAgIGlmIG9wdHMuZGlzdGluY3RcblxuICAgICAgIyBDaGVjayB0byBzZWUgaWYgdGhpcyBiYXNlIGhhcyBhIC1bMC05OTk5Li4uXSBhdCB0aGUgZW5kLCByZWR1Y2UgdG8gYSByZWFsIGJhc2VcbiAgICAgIHNsdWdCYXNlID0gc2x1Z0Jhc2UucmVwbGFjZSgvKC1cXGQrKSskLywnJylcbiAgICAgIGZzRGVidWcob3B0cyxzbHVnQmFzZSwnU2x1Z0Jhc2UgYWZ0ZXIgcmVkdWN0aW9uJylcblxuICAgICAgYmFzZUZpZWxkID0gXCJmcmllbmRseVNsdWdzLlwiICsgb3B0cy5zbHVnRmllbGQgKyBcIi5iYXNlXCJcbiAgICAgIGluZGV4RmllbGQgPSBcImZyaWVuZGx5U2x1Z3MuXCIgKyBvcHRzLnNsdWdGaWVsZCArIFwiLmluZGV4XCJcblxuICAgICAgZmllbGRTZWxlY3RvciA9IHt9XG4gICAgICBmaWVsZFNlbGVjdG9yW2Jhc2VGaWVsZF0gPSBzbHVnQmFzZVxuXG4gICAgICBpID0gMFxuICAgICAgd2hpbGUgaSA8IG9wdHMuZGlzdGluY3RVcFRvLmxlbmd0aFxuICAgICAgICBmID0gb3B0cy5kaXN0aW5jdFVwVG9baV1cbiAgICAgICAgZmllbGRTZWxlY3RvcltmXSA9IGRvY1tmXVxuICAgICAgICBpKytcblxuICAgICAgc29ydFNlbGVjdG9yID0ge31cbiAgICAgIHNvcnRTZWxlY3RvcltpbmRleEZpZWxkXSA9IC0xXG5cbiAgICAgIGxpbWl0U2VsZWN0b3IgPSB7fVxuICAgICAgbGltaXRTZWxlY3RvcltpbmRleEZpZWxkXSA9IDFcblxuICAgICAgcmVzdWx0ID0gY29sbGVjdGlvbi5maW5kT25lKGZpZWxkU2VsZWN0b3IsXG4gICAgICAgIHNvcnQ6IHNvcnRTZWxlY3RvclxuICAgICAgICBmaWVsZHM6IGxpbWl0U2VsZWN0b3JcbiAgICAgICAgbGltaXQ6MVxuICAgICAgKVxuXG4gICAgICBmc0RlYnVnKG9wdHMscmVzdWx0LCdIaWdoZXN0IGluZGV4ZWQgYmFzZSBmb3VuZCcpXG5cbiAgICAgIGlmICFyZXN1bHQ/IHx8ICFyZXN1bHQuZnJpZW5kbHlTbHVncz8gfHwgIXJlc3VsdC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXT8gfHwgIXJlc3VsdC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXS5pbmRleD9cbiAgICAgICAgaW5kZXggPSAwXG4gICAgICBlbHNlXG4gICAgICAgIGluZGV4ID0gcmVzdWx0LmZyaWVuZGx5U2x1Z3Nbb3B0cy5zbHVnRmllbGRdLmluZGV4ICsgMVxuXG4gICAgICBkZWZhdWx0U2x1Z0dlbmVyYXRvciA9IChzbHVnQmFzZSwgaW5kZXgpIC0+XG4gICAgICAgIGlmIGluZGV4IGlzIDAgdGhlbiBzbHVnQmFzZSBlbHNlIHNsdWdCYXNlICsgJy0nICsgaW5kZXhcblxuICAgICAgc2x1Z0dlbmVyYXRvciA9IG9wdHMuc2x1Z0dlbmVyYXRvciA/IGRlZmF1bHRTbHVnR2VuZXJhdG9yXG5cbiAgICAgIGZpbmFsU2x1ZyA9IHNsdWdHZW5lcmF0b3Ioc2x1Z0Jhc2UsIGluZGV4KVxuXG4gICAgZWxzZVxuICAgICAgI05vdCBkaXN0aW5jdCwganVzdCBzZXQgdGhlIGJhc2VcbiAgICAgIGluZGV4ID0gZmFsc2VcbiAgICAgIGZpbmFsU2x1ZyA9IHNsdWdCYXNlXG5cbiAgICBmc0RlYnVnKG9wdHMsZmluYWxTbHVnLCdmaW5hbFNsdWcnKVxuXG4gICAgaWYgbW9kaWZpZXIgb3IgY3JlYXRlXG4gICAgICBmc0RlYnVnKG9wdHMsJ1NldCB0byBtb2RpZnkgb3IgY3JlYXRlIHNsdWcgb24gdXBkYXRlJylcbiAgICAgIG1vZGlmaWVyID0gbW9kaWZpZXIgfHwge31cbiAgICAgIG1vZGlmaWVyLiRzZXQgPSBtb2RpZmllci4kc2V0IHx8IHt9XG4gICAgICBtb2RpZmllci4kc2V0LmZyaWVuZGx5U2x1Z3MgPSBkb2MuZnJpZW5kbHlTbHVncyB8fCB7fVxuICAgICAgbW9kaWZpZXIuJHNldC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXSA9IG1vZGlmaWVyLiRzZXQuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gfHwge31cbiAgICAgIG1vZGlmaWVyLiRzZXQuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0uYmFzZSA9IHNsdWdCYXNlXG4gICAgICBtb2RpZmllci4kc2V0LmZyaWVuZGx5U2x1Z3Nbb3B0cy5zbHVnRmllbGRdLmluZGV4ID0gaW5kZXhcbiAgICAgIG1vZGlmaWVyLiRzZXRbb3B0cy5zbHVnRmllbGRdID0gZmluYWxTbHVnXG4gICAgICBmc0RlYnVnKG9wdHMsbW9kaWZpZXIsJ0ZpbmFsIE1vZGlmaWVyJylcblxuICAgIGVsc2VcbiAgICAgIGZzRGVidWcob3B0cywnU2V0IHRvIHVwZGF0ZScpXG4gICAgICBkb2MuZnJpZW5kbHlTbHVncyA9IGRvYy5mcmllbmRseVNsdWdzIHx8IHt9XG4gICAgICBkb2MuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gPSBkb2MuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gfHwge31cbiAgICAgIGRvYy5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXS5iYXNlID0gc2x1Z0Jhc2VcbiAgICAgIGRvYy5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXS5pbmRleCA9IGluZGV4XG4gICAgICBkb2Nbb3B0cy5zbHVnRmllbGRdID0gZmluYWxTbHVnXG4gICAgICBmc0RlYnVnKG9wdHMsZG9jLCdGaW5hbCBEb2MnKVxuICAgIHJldHVybiB0cnVlXG5cbiAgZnNEZWJ1ZyA9IChvcHRzLCBpdGVtLCBsYWJlbCA9ICcnKS0+XG4gICAgcmV0dXJuIGlmICFvcHRzLmRlYnVnXG4gICAgaWYgdHlwZW9mIGl0ZW0gaXMgJ29iamVjdCdcbiAgICAgIGNvbnNvbGUubG9nIFwiZnJpZW5kbHlTbHVncyBERUJVRzogXCIgKyBsYWJlbCArICfihpMnXG4gICAgICBjb25zb2xlLmxvZyBpdGVtXG4gICAgZWxzZVxuICAgICAgY29uc29sZS5sb2cgXCJmcmllbmRseVNsdWdzIERFQlVHOiBcIiArIGxhYmVsICsgJz0gJyArIGl0ZW1cblxuc2x1Z2lmeSA9ICh0ZXh0LCB0cmFuc2xpdGVyYXRpb24sIG1heExlbmd0aCkgLT5cbiAgcmV0dXJuIGZhbHNlIGlmICF0ZXh0P1xuICByZXR1cm4gZmFsc2UgaWYgdGV4dC5sZW5ndGggPCAxXG4gIHRleHQgPSB0ZXh0LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKVxuICBfLmVhY2ggdHJhbnNsaXRlcmF0aW9uLCAoaXRlbSktPlxuICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UobmV3IFJlZ0V4cCgnWycraXRlbS5mcm9tKyddJywnZycpLGl0ZW0udG8pXG4gIHNsdWcgPSB0ZXh0XG4gICAgLnJlcGxhY2UoLycvZywgJycpICAgICAgICAgICAgICAjIFJlbW92ZSBhbGwgYXBvc3Ryb3BoZXNcbiAgICAucmVwbGFjZSgvW14wLTlhLXotXS9nLCAnLScpICAgICMgUmVwbGFjZSBhbnl0aGluZyB0aGF0IGlzIG5vdCAwLTksIGEteiwgb3IgLSB3aXRoIC1cbiAgICAucmVwbGFjZSgvXFwtXFwtKy9nLCAnLScpICAgICAgICAgIyBSZXBsYWNlIG11bHRpcGxlIC0gd2l0aCBzaW5nbGUgLVxuICAgIC5yZXBsYWNlKC9eLSsvLCAnJykgICAgICAgICAgICAgIyBUcmltIC0gZnJvbSBzdGFydCBvZiB0ZXh0XG4gICAgLnJlcGxhY2UoLy0rJC8sICcnKTsgICAgICAgICAgICAjIFRyaW0gLSBmcm9tIGVuZCBvZiB0ZXh0XG4gIGlmIG1heExlbmd0aCA+IDAgJiYgc2x1Zy5sZW5ndGggPiBtYXhMZW5ndGhcbiAgICBsYXN0RGFzaCA9IHNsdWcuc3Vic3RyaW5nKDAsbWF4TGVuZ3RoKS5sYXN0SW5kZXhPZignLScpXG4gICAgc2x1ZyA9IHNsdWcuc3Vic3RyaW5nKDAsbGFzdERhc2gpXG4gIHJldHVybiBzbHVnXG5cbnN0cmluZ1RvTmVzdGVkID0gKG9iaiwgcGF0aCkgLT5cbiAgcGFydHMgPSBwYXRoLnNwbGl0KFwiLlwiKVxuICBpZiBwYXJ0cy5sZW5ndGg9PTFcbiAgICBpZiBvYmo/ICYmIG9ialtwYXJ0c1swXV0/XG4gICAgICByZXR1cm4gb2JqW3BhcnRzWzBdXVxuICAgIGVsc2VcbiAgICAgIHJldHVybiBmYWxzZVxuICByZXR1cm4gc3RyaW5nVG9OZXN0ZWQob2JqW3BhcnRzWzBdXSwgcGFydHMuc2xpY2UoMSkuam9pbihcIi5cIikpXG4iLCJ2YXIgTW9uZ28sIHNsdWdpZnksIHN0cmluZ1RvTmVzdGVkO1xuXG5pZiAodHlwZW9mIE1vbmdvID09PSBcInVuZGVmaW5lZFwiKSB7XG4gIE1vbmdvID0ge307XG4gIE1vbmdvLkNvbGxlY3Rpb24gPSBNZXRlb3IuQ29sbGVjdGlvbjtcbn1cblxuTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGUuZnJpZW5kbHlTbHVncyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgdmFyIGNvbGxlY3Rpb24sIGZzRGVidWcsIHJ1blNsdWc7XG4gIGlmIChvcHRpb25zID09IG51bGwpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cbiAgY29sbGVjdGlvbiA9IHRoaXM7XG4gIGlmICghXy5pc0FycmF5KG9wdGlvbnMpKSB7XG4gICAgb3B0aW9ucyA9IFtvcHRpb25zXTtcbiAgfVxuICBfLmVhY2gob3B0aW9ucywgZnVuY3Rpb24ob3B0cykge1xuICAgIHZhciBkZWZhdWx0cywgZmllbGRzO1xuICAgIGlmIChfLmlzU3RyaW5nKG9wdHMpKSB7XG4gICAgICBvcHRzID0ge1xuICAgICAgICBzbHVnRnJvbTogW29wdHNdXG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAoXy5pc1N0cmluZyhvcHRzLnNsdWdGcm9tKSkge1xuICAgICAgb3B0cy5zbHVnRnJvbSA9IFtvcHRzLnNsdWdGcm9tXTtcbiAgICB9XG4gICAgZGVmYXVsdHMgPSB7XG4gICAgICBzbHVnRnJvbTogWyduYW1lJ10sXG4gICAgICBzbHVnRmllbGQ6ICdzbHVnJyxcbiAgICAgIGRpc3RpbmN0OiB0cnVlLFxuICAgICAgZGlzdGluY3RVcFRvOiBbXSxcbiAgICAgIHVwZGF0ZVNsdWc6IHRydWUsXG4gICAgICBjcmVhdGVPblVwZGF0ZTogdHJ1ZSxcbiAgICAgIG1heExlbmd0aDogMCxcbiAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgIHRyYW5zbGl0ZXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgZnJvbTogJ8Ogw6HDosOkw6XDo9CwJyxcbiAgICAgICAgICB0bzogJ2EnXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAn0LEnLFxuICAgICAgICAgIHRvOiAnYidcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfDpycsXG4gICAgICAgICAgdG86ICdjJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9C0JyxcbiAgICAgICAgICB0bzogJ2QnXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAnw6jDqcOqw6vhur3RjdC1JyxcbiAgICAgICAgICB0bzogJ2UnXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAn0YQnLFxuICAgICAgICAgIHRvOiAnZidcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQsycsXG4gICAgICAgICAgdG86ICdnJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9GFJyxcbiAgICAgICAgICB0bzogJ2gnXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAnw6zDrcOuw6/QuCcsXG4gICAgICAgICAgdG86ICdpJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9C6JyxcbiAgICAgICAgICB0bzogJ2snXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAn0LsnLFxuICAgICAgICAgIHRvOiAnbCdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQvCcsXG4gICAgICAgICAgdG86ICdtJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ8Ox0L0nLFxuICAgICAgICAgIHRvOiAnbidcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfDssOzw7TDtsO10L4nLFxuICAgICAgICAgIHRvOiAnbydcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQvycsXG4gICAgICAgICAgdG86ICdwJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9GAJyxcbiAgICAgICAgICB0bzogJ3InXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBmcm9tOiAn0YEnLFxuICAgICAgICAgIHRvOiAncydcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRgicsXG4gICAgICAgICAgdG86ICd0J1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ8O5w7rDu8O80YMnLFxuICAgICAgICAgIHRvOiAndSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQsicsXG4gICAgICAgICAgdG86ICd2J1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9C50YsnLFxuICAgICAgICAgIHRvOiAneSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQtycsXG4gICAgICAgICAgdG86ICd6J1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ8OmJyxcbiAgICAgICAgICB0bzogJ2FlJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9GHJyxcbiAgICAgICAgICB0bzogJ2NoJ1xuICAgICAgICB9LCB7XG4gICAgICAgICAgZnJvbTogJ9GJJyxcbiAgICAgICAgICB0bzogJ3NjaCdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRiCcsXG4gICAgICAgICAgdG86ICdzaCdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRhicsXG4gICAgICAgICAgdG86ICd0cydcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRjycsXG4gICAgICAgICAgdG86ICd5YSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRjicsXG4gICAgICAgICAgdG86ICd5dSdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfQticsXG4gICAgICAgICAgdG86ICd6aCdcbiAgICAgICAgfSwge1xuICAgICAgICAgIGZyb206ICfRitGMJyxcbiAgICAgICAgICB0bzogJydcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH07XG4gICAgXy5kZWZhdWx0cyhvcHRzLCBkZWZhdWx0cyk7XG4gICAgZmllbGRzID0ge1xuICAgICAgc2x1Z0Zyb206IEFycmF5LFxuICAgICAgc2x1Z0ZpZWxkOiBTdHJpbmcsXG4gICAgICBkaXN0aW5jdDogQm9vbGVhbixcbiAgICAgIGNyZWF0ZU9uVXBkYXRlOiBCb29sZWFuLFxuICAgICAgbWF4TGVuZ3RoOiBOdW1iZXIsXG4gICAgICBkZWJ1ZzogQm9vbGVhblxuICAgIH07XG4gICAgaWYgKHR5cGVvZiBvcHRzLnVwZGF0ZVNsdWcgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgaWYgKG9wdHMudXBkYXRlU2x1Zykge1xuICAgICAgICBvcHRzLnVwZGF0ZVNsdWcgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9wdHMudXBkYXRlU2x1ZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgY2hlY2sob3B0cywgTWF0Y2guT2JqZWN0SW5jbHVkaW5nKGZpZWxkcykpO1xuICAgIGNvbGxlY3Rpb24uYmVmb3JlLmluc2VydChmdW5jdGlvbih1c2VySWQsIGRvYykge1xuICAgICAgZnNEZWJ1ZyhvcHRzLCAnYmVmb3JlLmluc2VydCBmdW5jdGlvbicpO1xuICAgICAgcnVuU2x1Zyhkb2MsIG9wdHMpO1xuICAgIH0pO1xuICAgIGNvbGxlY3Rpb24uYmVmb3JlLnVwZGF0ZShmdW5jdGlvbih1c2VySWQsIGRvYywgZmllbGROYW1lcywgbW9kaWZpZXIsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBjbGVhbk1vZGlmaWVyLCBjb250LCBzbHVnRnJvbUNoYW5nZWQ7XG4gICAgICBmc0RlYnVnKG9wdHMsICdiZWZvcmUudXBkYXRlIGZ1bmN0aW9uJyk7XG4gICAgICBjbGVhbk1vZGlmaWVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChfLmlzRW1wdHkobW9kaWZpZXIuJHNldCkpIHtcbiAgICAgICAgICByZXR1cm4gZGVsZXRlIG1vZGlmaWVyLiRzZXQ7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIGlmIChvcHRpb25zLm11bHRpKSB7XG4gICAgICAgIGZzRGVidWcob3B0cywgXCJtdWx0aSBkb2MgdXBkYXRlIGF0dGVtcHRlZCwgY2FuJ3QgdXBkYXRlIHNsdWdzIHRoaXMgd2F5LCBsZWF2aW5nLlwiKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBtb2RpZmllciA9IG1vZGlmaWVyIHx8IHt9O1xuICAgICAgbW9kaWZpZXIuJHNldCA9IG1vZGlmaWVyLiRzZXQgfHwge307XG4gICAgICBjb250ID0gZmFsc2U7XG4gICAgICBfLmVhY2gob3B0cy5zbHVnRnJvbSwgZnVuY3Rpb24oc2x1Z0Zyb20pIHtcbiAgICAgICAgaWYgKHN0cmluZ1RvTmVzdGVkKGRvYywgc2x1Z0Zyb20pIHx8IChtb2RpZmllci4kc2V0W3NsdWdGcm9tXSAhPSBudWxsKSB8fCBzdHJpbmdUb05lc3RlZChtb2RpZmllci4kc2V0LCBzbHVnRnJvbSkpIHtcbiAgICAgICAgICByZXR1cm4gY29udCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCFjb250KSB7XG4gICAgICAgIGZzRGVidWcob3B0cywgXCJubyBzbHVnRnJvbSBmaWVsZHMgYXJlIHByZXNlbnQgKGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdXBkYXRlKSwgbGVhdmluZy5cIik7XG4gICAgICAgIGNsZWFuTW9kaWZpZXIoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBzbHVnRnJvbUNoYW5nZWQgPSBmYWxzZTtcbiAgICAgIF8uZWFjaChvcHRzLnNsdWdGcm9tLCBmdW5jdGlvbihzbHVnRnJvbSkge1xuICAgICAgICB2YXIgZG9jRnJvbTtcbiAgICAgICAgaWYgKChtb2RpZmllci4kc2V0W3NsdWdGcm9tXSAhPSBudWxsKSB8fCBzdHJpbmdUb05lc3RlZChtb2RpZmllci4kc2V0LCBzbHVnRnJvbSkpIHtcbiAgICAgICAgICBkb2NGcm9tID0gc3RyaW5nVG9OZXN0ZWQoZG9jLCBzbHVnRnJvbSk7XG4gICAgICAgICAgaWYgKChkb2NGcm9tICE9PSBtb2RpZmllci4kc2V0W3NsdWdGcm9tXSkgJiYgKGRvY0Zyb20gIT09IHN0cmluZ1RvTmVzdGVkKG1vZGlmaWVyLiRzZXQsIHNsdWdGcm9tKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzbHVnRnJvbUNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBmc0RlYnVnKG9wdHMsIHNsdWdGcm9tQ2hhbmdlZCwgJ3NsdWdGcm9tQ2hhbmdlZCcpO1xuICAgICAgaWYgKCFzdHJpbmdUb05lc3RlZChkb2MsIG9wdHMuc2x1Z0ZpZWxkKSAmJiBvcHRzLmNyZWF0ZU9uVXBkYXRlKSB7XG4gICAgICAgIGZzRGVidWcob3B0cywgJ1VwZGF0ZTogU2x1ZyBGaWVsZCBpcyBtaXNzaW5nIGFuZCBjcmVhdGVPblVwZGF0ZSBpcyBzZXQgdG8gdHJ1ZScpO1xuICAgICAgICBpZiAoc2x1Z0Zyb21DaGFuZ2VkKSB7XG4gICAgICAgICAgZnNEZWJ1ZyhvcHRzLCAnc2x1Z0Zyb20gZmllbGQgaGFzIGNoYW5nZWQsIHJ1blNsdWcgd2l0aCBtb2RpZmllcicpO1xuICAgICAgICAgIHJ1blNsdWcoZG9jLCBvcHRzLCBtb2RpZmllcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnNEZWJ1ZyhvcHRzLCAncnVuU2x1ZyB0byBjcmVhdGUnKTtcbiAgICAgICAgICBydW5TbHVnKGRvYywgb3B0cywgbW9kaWZpZXIsIHRydWUpO1xuICAgICAgICAgIGNsZWFuTW9kaWZpZXIoKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCh0eXBlb2Ygb3B0cy51cGRhdGVTbHVnID09PSBcImZ1bmN0aW9uXCIgPyBvcHRzLnVwZGF0ZVNsdWcoZG9jLCBtb2RpZmllcikgOiB2b2lkIDApID09PSBmYWxzZSkge1xuICAgICAgICAgIGZzRGVidWcob3B0cywgJ3VwZGF0ZVNsdWcgaXMgZmFsc2UsIG5vdGhpbmcgdG8gZG8uJyk7XG4gICAgICAgICAgY2xlYW5Nb2RpZmllcigpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2x1Z0Zyb21DaGFuZ2VkKSB7XG4gICAgICAgICAgZnNEZWJ1ZyhvcHRzLCAnc2x1Z0Zyb20gZmllbGQgaGFzIG5vdCBjaGFuZ2VkLCBub3RoaW5nIHRvIGRvLicpO1xuICAgICAgICAgIGNsZWFuTW9kaWZpZXIoKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBydW5TbHVnKGRvYywgb3B0cywgbW9kaWZpZXIpO1xuICAgICAgICBjbGVhbk1vZGlmaWVyKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgY2xlYW5Nb2RpZmllcigpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0pO1xuICBydW5TbHVnID0gZnVuY3Rpb24oZG9jLCBvcHRzLCBtb2RpZmllciwgY3JlYXRlKSB7XG4gICAgdmFyIGJhc2VGaWVsZCwgY29tYmluZUZyb20sIGRlZmF1bHRTbHVnR2VuZXJhdG9yLCBmLCBmaWVsZFNlbGVjdG9yLCBmaW5hbFNsdWcsIGZyb20sIGksIGluZGV4LCBpbmRleEZpZWxkLCBsaW1pdFNlbGVjdG9yLCByZWYsIHJlc3VsdCwgc2x1Z0Jhc2UsIHNsdWdHZW5lcmF0b3IsIHNvcnRTZWxlY3RvcjtcbiAgICBpZiAobW9kaWZpZXIgPT0gbnVsbCkge1xuICAgICAgbW9kaWZpZXIgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGNyZWF0ZSA9PSBudWxsKSB7XG4gICAgICBjcmVhdGUgPSBmYWxzZTtcbiAgICB9XG4gICAgZnNEZWJ1ZyhvcHRzLCAnQmVnaW4gcnVuU2x1ZycpO1xuICAgIGZzRGVidWcob3B0cywgb3B0cywgJ09wdGlvbnMnKTtcbiAgICBmc0RlYnVnKG9wdHMsIG1vZGlmaWVyLCAnTW9kaWZpZXInKTtcbiAgICBmc0RlYnVnKG9wdHMsIGNyZWF0ZSwgJ0NyZWF0ZScpO1xuICAgIGNvbWJpbmVGcm9tID0gZnVuY3Rpb24oZG9jLCBmaWVsZHMsIG1vZGlmaWVyRG9jKSB7XG4gICAgICB2YXIgZnJvbVZhbHVlcztcbiAgICAgIGZyb21WYWx1ZXMgPSBbXTtcbiAgICAgIF8uZWFjaChmaWVsZHMsIGZ1bmN0aW9uKGYpIHtcbiAgICAgICAgdmFyIHZhbDtcbiAgICAgICAgaWYgKG1vZGlmaWVyRG9jICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoc3RyaW5nVG9OZXN0ZWQobW9kaWZpZXJEb2MsIGYpKSB7XG4gICAgICAgICAgICB2YWwgPSBzdHJpbmdUb05lc3RlZChtb2RpZmllckRvYywgZik7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbCA9IHN0cmluZ1RvTmVzdGVkKGRvYywgZik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbCA9IHN0cmluZ1RvTmVzdGVkKGRvYywgZik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgIHJldHVybiBmcm9tVmFsdWVzLnB1c2godmFsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoZnJvbVZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZyb21WYWx1ZXMuam9pbignLScpO1xuICAgIH07XG4gICAgZnJvbSA9IGNyZWF0ZSB8fCAhbW9kaWZpZXIgPyBjb21iaW5lRnJvbShkb2MsIG9wdHMuc2x1Z0Zyb20pIDogY29tYmluZUZyb20oZG9jLCBvcHRzLnNsdWdGcm9tLCBtb2RpZmllci4kc2V0KTtcbiAgICBpZiAoZnJvbSA9PT0gZmFsc2UpIHtcbiAgICAgIGZzRGVidWcob3B0cywgXCJOb3RoaW5nIHRvIHNsdWcgZnJvbSwgbGVhdmluZy5cIik7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZnNEZWJ1ZyhvcHRzLCBmcm9tLCAnU2x1Z2dpbmcgRnJvbScpO1xuICAgIHNsdWdCYXNlID0gc2x1Z2lmeShmcm9tLCBvcHRzLnRyYW5zbGl0ZXJhdGlvbiwgb3B0cy5tYXhMZW5ndGgpO1xuICAgIGlmICghc2x1Z0Jhc2UpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnNEZWJ1ZyhvcHRzLCBzbHVnQmFzZSwgJ1NsdWdCYXNlIGJlZm9yZSByZWR1Y3Rpb24nKTtcbiAgICBpZiAob3B0cy5kaXN0aW5jdCkge1xuICAgICAgc2x1Z0Jhc2UgPSBzbHVnQmFzZS5yZXBsYWNlKC8oLVxcZCspKyQvLCAnJyk7XG4gICAgICBmc0RlYnVnKG9wdHMsIHNsdWdCYXNlLCAnU2x1Z0Jhc2UgYWZ0ZXIgcmVkdWN0aW9uJyk7XG4gICAgICBiYXNlRmllbGQgPSBcImZyaWVuZGx5U2x1Z3MuXCIgKyBvcHRzLnNsdWdGaWVsZCArIFwiLmJhc2VcIjtcbiAgICAgIGluZGV4RmllbGQgPSBcImZyaWVuZGx5U2x1Z3MuXCIgKyBvcHRzLnNsdWdGaWVsZCArIFwiLmluZGV4XCI7XG4gICAgICBmaWVsZFNlbGVjdG9yID0ge307XG4gICAgICBmaWVsZFNlbGVjdG9yW2Jhc2VGaWVsZF0gPSBzbHVnQmFzZTtcbiAgICAgIGkgPSAwO1xuICAgICAgd2hpbGUgKGkgPCBvcHRzLmRpc3RpbmN0VXBUby5sZW5ndGgpIHtcbiAgICAgICAgZiA9IG9wdHMuZGlzdGluY3RVcFRvW2ldO1xuICAgICAgICBmaWVsZFNlbGVjdG9yW2ZdID0gZG9jW2ZdO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICBzb3J0U2VsZWN0b3IgPSB7fTtcbiAgICAgIHNvcnRTZWxlY3RvcltpbmRleEZpZWxkXSA9IC0xO1xuICAgICAgbGltaXRTZWxlY3RvciA9IHt9O1xuICAgICAgbGltaXRTZWxlY3RvcltpbmRleEZpZWxkXSA9IDE7XG4gICAgICByZXN1bHQgPSBjb2xsZWN0aW9uLmZpbmRPbmUoZmllbGRTZWxlY3Rvciwge1xuICAgICAgICBzb3J0OiBzb3J0U2VsZWN0b3IsXG4gICAgICAgIGZpZWxkczogbGltaXRTZWxlY3RvcixcbiAgICAgICAgbGltaXQ6IDFcbiAgICAgIH0pO1xuICAgICAgZnNEZWJ1ZyhvcHRzLCByZXN1bHQsICdIaWdoZXN0IGluZGV4ZWQgYmFzZSBmb3VuZCcpO1xuICAgICAgaWYgKChyZXN1bHQgPT0gbnVsbCkgfHwgKHJlc3VsdC5mcmllbmRseVNsdWdzID09IG51bGwpIHx8IChyZXN1bHQuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gPT0gbnVsbCkgfHwgKHJlc3VsdC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXS5pbmRleCA9PSBudWxsKSkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmRleCA9IHJlc3VsdC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXS5pbmRleCArIDE7XG4gICAgICB9XG4gICAgICBkZWZhdWx0U2x1Z0dlbmVyYXRvciA9IGZ1bmN0aW9uKHNsdWdCYXNlLCBpbmRleCkge1xuICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gc2x1Z0Jhc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHNsdWdCYXNlICsgJy0nICsgaW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzbHVnR2VuZXJhdG9yID0gKHJlZiA9IG9wdHMuc2x1Z0dlbmVyYXRvcikgIT0gbnVsbCA/IHJlZiA6IGRlZmF1bHRTbHVnR2VuZXJhdG9yO1xuICAgICAgZmluYWxTbHVnID0gc2x1Z0dlbmVyYXRvcihzbHVnQmFzZSwgaW5kZXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IGZhbHNlO1xuICAgICAgZmluYWxTbHVnID0gc2x1Z0Jhc2U7XG4gICAgfVxuICAgIGZzRGVidWcob3B0cywgZmluYWxTbHVnLCAnZmluYWxTbHVnJyk7XG4gICAgaWYgKG1vZGlmaWVyIHx8IGNyZWF0ZSkge1xuICAgICAgZnNEZWJ1ZyhvcHRzLCAnU2V0IHRvIG1vZGlmeSBvciBjcmVhdGUgc2x1ZyBvbiB1cGRhdGUnKTtcbiAgICAgIG1vZGlmaWVyID0gbW9kaWZpZXIgfHwge307XG4gICAgICBtb2RpZmllci4kc2V0ID0gbW9kaWZpZXIuJHNldCB8fCB7fTtcbiAgICAgIG1vZGlmaWVyLiRzZXQuZnJpZW5kbHlTbHVncyA9IGRvYy5mcmllbmRseVNsdWdzIHx8IHt9O1xuICAgICAgbW9kaWZpZXIuJHNldC5mcmllbmRseVNsdWdzW29wdHMuc2x1Z0ZpZWxkXSA9IG1vZGlmaWVyLiRzZXQuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gfHwge307XG4gICAgICBtb2RpZmllci4kc2V0LmZyaWVuZGx5U2x1Z3Nbb3B0cy5zbHVnRmllbGRdLmJhc2UgPSBzbHVnQmFzZTtcbiAgICAgIG1vZGlmaWVyLiRzZXQuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0uaW5kZXggPSBpbmRleDtcbiAgICAgIG1vZGlmaWVyLiRzZXRbb3B0cy5zbHVnRmllbGRdID0gZmluYWxTbHVnO1xuICAgICAgZnNEZWJ1ZyhvcHRzLCBtb2RpZmllciwgJ0ZpbmFsIE1vZGlmaWVyJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZzRGVidWcob3B0cywgJ1NldCB0byB1cGRhdGUnKTtcbiAgICAgIGRvYy5mcmllbmRseVNsdWdzID0gZG9jLmZyaWVuZGx5U2x1Z3MgfHwge307XG4gICAgICBkb2MuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gPSBkb2MuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0gfHwge307XG4gICAgICBkb2MuZnJpZW5kbHlTbHVnc1tvcHRzLnNsdWdGaWVsZF0uYmFzZSA9IHNsdWdCYXNlO1xuICAgICAgZG9jLmZyaWVuZGx5U2x1Z3Nbb3B0cy5zbHVnRmllbGRdLmluZGV4ID0gaW5kZXg7XG4gICAgICBkb2Nbb3B0cy5zbHVnRmllbGRdID0gZmluYWxTbHVnO1xuICAgICAgZnNEZWJ1ZyhvcHRzLCBkb2MsICdGaW5hbCBEb2MnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG4gIHJldHVybiBmc0RlYnVnID0gZnVuY3Rpb24ob3B0cywgaXRlbSwgbGFiZWwpIHtcbiAgICBpZiAobGFiZWwgPT0gbnVsbCkge1xuICAgICAgbGFiZWwgPSAnJztcbiAgICB9XG4gICAgaWYgKCFvcHRzLmRlYnVnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnNvbGUubG9nKFwiZnJpZW5kbHlTbHVncyBERUJVRzogXCIgKyBsYWJlbCArICfihpMnKTtcbiAgICAgIHJldHVybiBjb25zb2xlLmxvZyhpdGVtKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiZnJpZW5kbHlTbHVncyBERUJVRzogXCIgKyBsYWJlbCArICc9ICcgKyBpdGVtKTtcbiAgICB9XG4gIH07XG59O1xuXG5zbHVnaWZ5ID0gZnVuY3Rpb24odGV4dCwgdHJhbnNsaXRlcmF0aW9uLCBtYXhMZW5ndGgpIHtcbiAgdmFyIGxhc3REYXNoLCBzbHVnO1xuICBpZiAodGV4dCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh0ZXh0Lmxlbmd0aCA8IDEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdGV4dCA9IHRleHQudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpO1xuICBfLmVhY2godHJhbnNsaXRlcmF0aW9uLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuIHRleHQgPSB0ZXh0LnJlcGxhY2UobmV3IFJlZ0V4cCgnWycgKyBpdGVtLmZyb20gKyAnXScsICdnJyksIGl0ZW0udG8pO1xuICB9KTtcbiAgc2x1ZyA9IHRleHQucmVwbGFjZSgvJy9nLCAnJykucmVwbGFjZSgvW14wLTlhLXotXS9nLCAnLScpLnJlcGxhY2UoL1xcLVxcLSsvZywgJy0nKS5yZXBsYWNlKC9eLSsvLCAnJykucmVwbGFjZSgvLSskLywgJycpO1xuICBpZiAobWF4TGVuZ3RoID4gMCAmJiBzbHVnLmxlbmd0aCA+IG1heExlbmd0aCkge1xuICAgIGxhc3REYXNoID0gc2x1Zy5zdWJzdHJpbmcoMCwgbWF4TGVuZ3RoKS5sYXN0SW5kZXhPZignLScpO1xuICAgIHNsdWcgPSBzbHVnLnN1YnN0cmluZygwLCBsYXN0RGFzaCk7XG4gIH1cbiAgcmV0dXJuIHNsdWc7XG59O1xuXG5zdHJpbmdUb05lc3RlZCA9IGZ1bmN0aW9uKG9iaiwgcGF0aCkge1xuICB2YXIgcGFydHM7XG4gIHBhcnRzID0gcGF0aC5zcGxpdChcIi5cIik7XG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDEpIHtcbiAgICBpZiAoKG9iaiAhPSBudWxsKSAmJiAob2JqW3BhcnRzWzBdXSAhPSBudWxsKSkge1xuICAgICAgcmV0dXJuIG9ialtwYXJ0c1swXV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHN0cmluZ1RvTmVzdGVkKG9ialtwYXJ0c1swXV0sIHBhcnRzLnNsaWNlKDEpLmpvaW4oXCIuXCIpKTtcbn07XG4iXX0=

/* globals Ember, Proxy */
(function() {
  'use strict';

  var HAS_NATIVE_PROXY = typeof Proxy === 'function';

  function factoryFor(fullName) {
    var FactoryManager = {
      class: this._lookupFactory(fullName),

      create: function() {
        return this.class.create.apply(this.class, arguments);
      }
    };

    if (HAS_NATIVE_PROXY) {
      Ember.runInDebug(function() {
        var validator = {
          get: function(obj, prop) {
            if (prop !== 'class' && prop !== 'create') {
              throw new Error('You attempted to access "' + prop + '" on a factory manager created by container#factoryFor. "' + prop + '" is not a member of a factory manager.');
            }

            return obj[prop];
          },
          set: function(obj, prop, value) {
            throw new Error('You attempted to set "' + prop + '" on a factory manager created by container#factoryFor. A factory manager is a read-only construct.');
          }
        };

        // Note:
        // We have to proxy access to the manager here so that private property
        // access doesn't cause the above errors to occur.
        var m = FactoryManager;
        var proxiedManager = {
          class: m.class,
          create: function(props) {
            return m.create(props);
          }
        };

        FactoryManager = new Proxy(proxiedManager, validator);
      });
    }

    return FactoryManager;
  }

  var FactoryForMixin = Ember.Mixin.create({
    factoryFor: factoryFor
  });

  // added in Ember 2.8
  if (Ember.ApplicationInstance) {
    // augment the main application's "owner"
    Ember.ApplicationInstance.reopen(FactoryForMixin);
  } else {
    // in Ember < 2.8 the Ember.ApplicationInstance is not
    // exposed globally, so we have to monkey patch the
    // `Ember.Application#buildInstance` method to ensure
    // that the built instance has a `factoryFor` method
    // this gives us support for Ember 2.3 - 2.7
    Ember.Application.reopen({
      buildInstance: function(_options) {
        var options = _options || {};
        options.factoryFor = factoryFor;

        return this._super(options);
      }
    });
  }

  // added in Ember 2.3
  if (Ember._ContainerProxyMixin) {
    // supports ember-test-helpers's build-registry (and other tooling that use
    // Ember._ContainerProxyMixin to emulate an "owner")
    var ContainerProxyMixinWithFactoryFor = Ember.Mixin.create(Ember._ContainerProxyMixin, FactoryForMixin);
    Ember._ContainerProxyMixin = ContainerProxyMixinWithFactoryFor;
  }
})();

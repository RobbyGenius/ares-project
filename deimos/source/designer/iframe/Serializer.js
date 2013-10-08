enyo.kind({
	name: "Ares.Serializer",
	kind: "Component",
	//* public
	serialize: function(inContainer, inIncludeAresId) {
		var s = this._serialize(inContainer, inIncludeAresId);
		return enyo.json.codify.to(s, null, 4);
	},
	getComponents: function(inContainer, inIncludeAresId) {
		return this._serialize(inContainer, inIncludeAresId);
	},
	serializeComponent: function(inComponent, inIncludeAresId) {
		var s = this._serializeComponent(inComponent, inIncludeAresId);
		return enyo.json.codify.to(s, null, 4);
	},
	published: {
		// contains serialization data extracted (but not cloned) from .design files
		serializerOptions: null
	},
	//* protected
	noserialize: {owner: 1, container: 1, parent: 1, id: 1, attributes: 1, selected: 1, active: 1, isContainer: 1},
	_serialize: function(inContainer, inIncludeAresId) {
		var s = [],
			c$ = this.getAresComponents(inContainer);
		
		for (var i=0, c; (c=c$[i]); i++) {
			s.push(this._serializeComponent(c, inIncludeAresId));
		}
		
		return s;
	},
	getAresComponents: function(inContainer) {
		var a = [],
			c$  = inContainer.controls || inContainer.children;
		
		if(!c$) {
			return a;
		}
		
		for(var i=0, c;(c=c$[i]);i++) {
			if(c.aresComponent) {
				a.push(c);
			} else if (c.kind === 'enyo.OwnerProxy') {
				/*
					We are processing the child of a Repeater or List.
					So, just skip the "enyo.OwnerProxy", but serialize
					the embedded components.
				 */
				var other = c.controls || c.children;
				for(var idx = 0 ; idx < other.length ; idx++) {
					if (other[idx].aresComponent) {
						a.push(other[idx]);
					}
				}
			}
		}
		
		return a;
	},
	_serializeComponent: function(inComponent, inIncludeAresId) {
		var p = this.serializeProps(inComponent, inIncludeAresId);
		if (inComponent instanceof enyo.Control) {
			var cs = this._serialize(inComponent, inIncludeAresId);
			if (cs && cs.length) {
				p.components = cs;
			}
		}
		this.serializeEvents(p, inComponent);
		return p;
	},
	serializeProps: function(inComponent, inIncludeAresId) {
		var o = {
			kind: this.getComponentKindName(inComponent)
		};
		var ps = this.buildPropList(inComponent, "published");
		var proto = inComponent.ctor.prototype;
		for (var j=0, p; (p=ps[j]); j++) {
			if (this.isSerializable(inComponent.kind, p) && proto[p] != inComponent[p] && inComponent[p] !== "") {
				o[p] = inComponent[p];
			}
		}
		if (inIncludeAresId) {
			o.aresId = inComponent.aresId;
			o.__aresOptions = inComponent.__aresOptions;
		}
		return o;
	},
	getComponentKindName: function(inComponent) {
		var k = inComponent.kindName.split(".");
		if (k[0] == "enyo") {
			k.shift();
		}
		return k.join(".");
	},
	serializeEvents: function(inProps, inComponent) {
		var ps = this.buildPropList(inComponent, "events");
		var proto = inComponent.ctor.prototype;
		for (var j=0, p; (p=ps[j]); j++) {
			if (this.isSerializable(inComponent.kind, p) && proto[p] != inComponent[p] && inComponent[p] !== "") {
				inProps[p] = inComponent[p];
			}
		}
		// this catches any event handlers added that aren't in the "events" list (e.g. DOM events)
		for (p in inComponent) {
			if (inComponent.hasOwnProperty(p) && p.substring(0,2) == "on" && inComponent[p] !== "") {
				inProps[p] = inComponent[p];
			}
		}
		return inProps;
	},
	buildPropList: function(inControl, inSource) {
		var map = {};
		var context = inControl;
		while (context) {
			for (var i in context[inSource]) {
				map[i] = true;
			}
			context = context.base && context.base.prototype;
		}
		var props = [];
		for (var n in map) {
			props.push(n);
		}
		return props;
	},
	// @protected
	isSerializable: function(inKind, inProp) {
		if (this.noserialize[inProp] === 1) {
			return false;
		} else {
			var value = this.getSerializerOptions(inKind, inProp, "exclude");
			if (value === undefined) {
				return true;
			} else {
				return ! value;
			}
		}
	},
	// @protected
	getSerializerOptions: function(inKind, inPropName, inOptName) {
		try {
			return this.serializerOptions[inKind][inOptName][inPropName];
		} catch(error) {
			return;			// Just return an undefined value
		}
	}
});

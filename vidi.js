// ----------------------------------------------------------------------------
// vidi.js: A compact implementation of a vuejs-style templating engine for
//          javascript without the whole cognitive load of a framework.
//
// Copyright (c) 2020 Pim van Riezen <pi@madscience.nl>
// Provided under the GNU Library General Public License version 2 or newer
// ----------------------------------------------------------------------------

// ============================================================================
// CLASS NestProxy
// ---------------
// A variation of the JavaScript proxy object that survives nested
// hierarchies. The provided handler should implement a setPath() and
// getPath() function that handle actual access to the proxied data.
// ============================================================================
class NestProxy {
    constructor (target,handler,parent,key) {
        this.target = target;
        this.handler = handler;
        this.parent = parent ? parent : null;
        this.key = key ? key : null;
        this.subtrees = {};
        
        // Javascript class definitions use get/set for getters/setters,
        // but the javascript Proxy API demands an object to have members
        // with those exact names. So we cheese it.
        this.get = this.getProperty;
        this.set = this.setProperty;
    }
    
    // ------------------------------------------------------------------------
    // Returns an array of the path inside the object tree for this
    // particular instance
    // ------------------------------------------------------------------------
    keypath(plus) {
        let res = [];
        if (this.parent) {
            res = this.parent.keypath();
            res.push (this.key);
        }
        if (plus) res.push (plus);
        return res;
    }
    
    // ------------------------------------------------------------------------
    // Callback from the proxy object for getting a property
    // ------------------------------------------------------------------------
    getProperty(obj, prop) {
        if (this.subtrees[prop]) return this.subtrees[prop].p;
        let robj = this;
        while (robj.parent) robj = robj.parent;
        let handled = this.handler.getPath (robj.target, this.keypath(prop));
        if (handled === null || handled === undefined) return handled;
        if (typeof (handled) !== "object") return handled;
        if (handled instanceof Element) return handled;

        if (! this.target[prop]) this.target[prop] = {};        
        let dp = new NestProxy (this.target[prop], this.handler, this, prop);
        let p = new Proxy (this.target[prop], dp);
        this.subtrees[prop] = {p:p,dp:dp};
        return p;
    }
    
    // ------------------------------------------------------------------------
    // Callback from the proxy object for setting a property
    // ------------------------------------------------------------------------
    setProperty(obj, prop, value) {
        let isobj = (typeof (value) == "object");
        if (isobj && (value === null || value === undefined ||
            Array.isArray (value))) {
            isobj = false;
        }
        
        if (this.subtrees[prop]) {
            if (! isobj) delete this.subtrees[prop];
        }
        let robj = this;
        while (robj.parent) robj = robj.parent;
        
        if (! isobj) {
            return this.handler.setPath (robj.target, this.keypath(prop), value);
        }

        let subtree = this.subtrees[prop];
        if (! this.target[prop]) this.target[prop] = {};
        if (! subtree) {
            let dp = new NestProxy (this.target[prop], this.handler, this, prop);
            let p = new Proxy (this.target[prop], dp);
            subtree = this.subtrees[prop] = {p:p,dp:dp};
        }
        
        for (let k in value) {
            subtree.dp.setProperty (obj, k, value[k]);
        }
        return true;
    }
    
    // ------------------------------------------------------------------------
    // Callback from the proxy object for deleting a property
    // ------------------------------------------------------------------------
    deleteProperty(obj,prop) {
        if (this.subtrees[prop]) {
            delete this.subtrees[prop];
        }
        
        let robj = this;
        while (robj.parent) robj = robj.parent;
        return this.handler.deletePath (robj.target, this.keypath(prop));
    }
}

// ============================================================================
// Because javascript lacks actual convenient introspection, the native
// Proxy object is actually magical, so it needs to wrap itself against
// -our- proxy, which wrapped itself against the data object. This function
// performs this double wrapping for convenience sake.
// ============================================================================
NestProxy.create = function(target,handler) {
    return new Proxy (target, new NestProxy (target, handler));
}

// ============================================================================
// CLASS VidiView
// --------------
// Wraps a sub-tree of the browser DOM into a Vidi template, dynamically
// rendered according to the data put into its view member-object.
// ============================================================================
class VidiView
{
    // ------------------------------------------------------------------------
    // Constructor. Expects the id of the DOM node that is to be our template,
    // and a model-definition of what should go into the view.
    // ------------------------------------------------------------------------
    constructor(id,def) {
        let self = this;
        let model = def.model;
        
        for (let varname in model) {
            if (! varname.match (/^[a-zA-Z0-9_]+$/)) {
                console.error("[Vidi] model for view '#"+id+"' defines "+
                              "invalid top-level variable '"+varname+"'");
                throw new Error("Invalid model");
            }
        }
        
        for (let varname in def.methods) {
            if (! varname.match (/^[a-zA-Z0-9_]+$/)) {
                console.error("[Vidi] model for view '#"+id+"' defines "+
                              "invalid top-level method '"+varname+"'");
                throw new Error("Invalid model");
            }
            
            if (model[varname] !== undefined) {
                console.error("[Vidi] View '#"+id+"' defines a "+
                              "method '"+varname+"', which clashes with "+
                              "the model.");
                throw new Error("Invalid method");
            }
            
            if (typeof (def.methods[varname]) != "function") {
                console.error("[Vidi] View '#"+id+"' method '"+varname+"' "+
                              "is not a function");
                throw new Error("Invalid method");
            }
            model[varname] = def.methods[varname];
        }
        
        model.$el = null;
        
        // Set up private variables
        self.$ = self.querySelector;
        self.$id = id;
        
        self.$data = Vidi.clone (model);
        self.$el = null;
        
        if (def.watch) {
            self.$watch = def.watch
        }

        // Set up public variables
        self.view = NestProxy.create (self.$data, self);
        Vidi.views[id] = this;
        
        if (def.updated) {
            self.$onupdate = def.updated.bind(self.view);
        }
        
        if (def.created) {
            self.$oncreate = def.created.bind(self.view);
        }
        
        if (document.readyState === "complete") {
            self.init(id);
        }
        else {
            let self = this;
            window.addEventListener("load",function() {
                self.init(id);
            });
        }
    }
    
    // ------------------------------------------------------------------------
    // Binds to an actual DOM node. Gets called when the document readyState
    // is marked as complete.
    // ------------------------------------------------------------------------
    init(id) {
        let self = this;
        self.$template = document.getElementById (id);
        if (! self.$template) throw new Error("Could not bind to #"+id);
        self.$parent = self.$template.parentNode;
        // Render self
        self.render();
    }
    
    // ------------------------------------------------------------------------
    // Little shorthand for doing a query-selection on the view's head
    // element.
    // ------------------------------------------------------------------------
    querySelector(q) {
        let self = this;
        return self.$el.querySelector(q);
    }
    
    // ------------------------------------------------------------------------
    // Evals a double moustache-template value. This involves wrapping it
    // into a function that gets local references to all the model's listed
    // top-level variables, as well as an optional index and loop variable.
    // ------------------------------------------------------------------------
    eval(e,tempvars,noreturn) {
        let self = this;
        let src = "(function(){ return function(__self,__data,__locals) {";
        for (let id in self.$data) {
            src += "var "+id+" = __data."+id;
            if (typeof (self.$data[id]) == "function") {
                src += ".bind(self)"
            }
            src += ";"
        }
        for (let lid in tempvars) {
            src += "var "+lid+" = __locals."+lid+";";
        }
        
        // Handle variable assignments
        e = e.replace(/[a-zA-Z0-9_]+ *=[^=]/g, function (m) {
            let varname=m.replace(/ *=.*/,'');
            if (self.$data[varname] !== undefined) {
                return "__data."+m;
            }
            return m;
        });
        
        // Handle postincrements.
        e = e.replace(/[a-zA-Z0-9_]+[+-]{2}/g, function (m) {
            let varname=m.replace(/[+-]{2}/,'');
            if (self.$data[varname] !== undefined) {
                return "__data."+m;
            }
            return m;
        });

        // Handle preincrements.
        e = e.replace(/[+-]{2}[a-zA-Z0-9_]+/g, function (m) {
            let varname=m.replace(/[+-]{2}/,'');
            if (self.$data[varname] !== undefined) {
                return m.replace(/[+-]{2}/,function(m) {
                    return m+"__data.";
                });
            }
            return m;
        });

        if (noreturn) src += e +";";
        else src += "return ("+e+"); ";
        src += "}})()";
        
        try {
            return eval(src)(self,self.view,tempvars);
        }
        catch (e) {
            switch (e.name) {
                case "ReferenceError":
                    Vidi.warn ("Template for '#"+self.$id+"' references "+
                               "a variable not in its model: "+e.message);
                    break;
                    
                default:
                    Vidi.warn ("Parse in '#"+self.$id+"': "+e.message);
                    Vidi.warn ("text: "+src);
                    break;
            }
            return null;
        }
    }

    // ------------------------------------------------------------------------
    // Renders the view out into a DOM tree
    // ------------------------------------------------------------------------
    render() {
        let self = this;

        if (self.renderedOnce) {
            try {
                if (self.$onupdate) self.$onupdate(self);
            }
            catch (e) {
                console.warn ("[Vidi] Error in $onupdate for view '#"+
                              self.$id+"':",e);
            }
        }
        if (self.renderTimeout) return;
        
        let dorender = function() {
            if (Vidi.debug) {
                console.log ("render");
            }
            
            let div = self.$template.cloneNode(false);
            div.setAttribute ("id", self.$id);
            div.setAttribute ("v-view", self.$id);

            for (let node of self.$template.childNodes) {
                self.renderTemplate (div, node);
            }
            
            //console.log (div.innerHTML);

            if (self.$el) {
                self.transplantDom (self.$el, div, self.renderedOnce);
            }
            else {
                self.$parent.replaceChild (div, self.$template);
                self.$el = div;
            }
            if (! self.renderedOnce) {
                if (self.$oncreate) {
                    self.$oncreate (self);
                }
                self.renderedOnce = true;
            }
        }
        
        if (! self.renderedOnce) dorender();
        else {
            self.renderTimeout = setTimeout (function() {
                clearTimeout (self.renderTimeout);
                delete self.renderTimeout;
                dorender();
            }, 10 /* 100fps max, change to 7 for 144Hz support ;) */);
        }
    }
    
    // ------------------------------------------------------------------------
    // Set-handler for the NestProxy. We use this, rather tamely, to
    // detect changes to the view, so we can re-render the DOM tree.
    // ------------------------------------------------------------------------
    setPath (data, path, value) {
        let self = this;
        let obj = self.$data;
        let idx = 0;
        let key = null;
        
        if (path.length == 1) {
            if (self.$watch && self.$watch[path[0]]) {
                let fn = self.$watch[path[0]].bind(self.view);
                fn(value);
            }
        }
        
        for (idx=0; idx<(path.length-1); ++idx) {
            key = path[idx];
            if (obj[key] == undefined) {
                throw new Error("Can not set key '"+key+"'");
            }
            obj = obj[key];
        }
        key = path[idx];
        
        if (typeof(value) !== "object") {
            if (obj[key] === value) return true;
        }
        
        obj[key] = value;
        
        self.render();
        return true;
    }
    
    // ------------------------------------------------------------------------
    // Delete-handler for the NestProxy.
    // ------------------------------------------------------------------------
    deletePath (data, path) {
        let self = this;
        let obj = self.$data;
        let idx = 0;
        let key = null;
        for (idx=0; idx<(path.length-1); ++idx) {
            key = path[idx];
            if (obj[key] == undefined) {
                throw new Error("Can not set key '"+key+"'");
            }
            obj = obj[key];
        }
        key = path[idx];
        delete obj[key];
        self.render();
        return true;
    }
    
    // ------------------------------------------------------------------------
    // Get-handler for the NestProxy. Just stupidly forwards to the underlying
    // data in self.$data.
    // ------------------------------------------------------------------------
    getPath (data, path) {
        let self = this;
        let obj = self.$data;
        if (path[0] == "$el") {
            return self.$el;
        }

        if (path.length == 1) {
            if (path[0] == "$isView") return true;
        }
            
        for (let key of path) {
            if (typeof (obj) != "object") {
                return undefined;
            }
            obj = obj[key];
            if (! obj) return obj;
        }
        return obj;
    }
    
    // ------------------------------------------------------------------------
    // Creates a clone of an element. Note that this cannot include any
    // attached EventListeners.
    // ------------------------------------------------------------------------
    cloneElement (orig, tempvars) {
        let self = this;
        let nw = document.createElement(orig.tagName);
        let innerhtml = null;
        
        if (orig.getAttribute) {
            let vcomp = orig.getAttribute("v-component");

            if (vcomp) {
                let component = Vidi.components[vcomp];
                if (component) {
                    tempvars["$component"] = component.functions;
                    let vinstance = orig.getAttribute ("v-instance");
                    if (vinstance) {
                        let instance = Vidi.instances[vcomp][vinstance];
                        instance.view = self.view;
                        instance.render = function() { self.render(); };
                        tempvars["$instance"] = instance;
                    }
                }
            }
        }
        
        // We're cloning out of a template, so we'll need to handle
        // the attributes where needed, and copy the rest.
        if (orig.getAttributeNames) {
            let checksumstr = ""; // collect checksum for all code found in
                                  // v-on: attributes to generate a checksum
                                  // id. This allows us to distinguish nodes
                                  // with unique event listeners.
            for (let a of orig.getAttributeNames()) {
                let val = orig.getAttribute (a);
                
                // Vidi-specific attributes
                if (a.startsWith("v-")) {
                    // Handle the v-model property
                    let attrbase = a.split(':')[0];
                    switch (attrbase) {
                    
                        // The v-model attribute: Tracks changes to an
                        // input element's value and reflects them back
                        // to the view.
                        case "v-model":
                            let model = val;
                            let curval = self.view[model];
                            nw.value = curval;
                            nw.addEventListener("input", function() {
                                let newval = nw.value;
                                if (newval != curval) {
                                    self.view[model] = newval;
                                }
                            });
                            checksumstr += "//"+val;
                            break;
                        
                        // The v-on attribute: Sets up an event handler
                        // on an element.
                        case "v-on":
                            let evname = a.substr(5);
                            let ontv = Vidi.copy (tempvars);
                            if (val.indexOf('{{') >= 0) {
                                val = val.replace(/{{\s?([^}]*)\s?}}/g,
                                  function(m) {
                                  let src = m.substr(2,m.length-4);
                                  return self.eval(src, tempvars);
                                });
                            }

                            checksumstr += "//" + val;
                            nw.addEventListener(evname, function(e) {
                                ontv["$event"] = e;
                                self.eval(val, ontv, true);
                            });
                            break;
                         
                        // The v-bind attribute allows attribute-values
                        // to be programmatic from the view without needing
                        // to enmoustache their arguments, making setting
                        // up bindings from within a component less awkward.   
                        case "v-bind":
                            let bindto = a.substr(7);
                            
                            if (val.indexOf('{{') >= 0) {
                                val = val.replace(/{{\s?([^}]*)\s?}}/g,
                                  function(m) {
                                  let src = m.substr(2,m.length-4);
                                  return self.eval(src, tempvars);
                                });
                            }
                            
                            val = self.eval (val, tempvars);
                            if (val !== false && val !== undefined) {
                                if (val === true) {
                                    nw.setAttribute (bindto, "");
                                }
                                else {
                                    nw.setAttribute (bindto, val);
                                }
                            }
                            else if (val === false) {
                                nw.removeAttribute (bindto);
                            }
                            break;
                            
                        case "v-html":
                            innerhtml = self.eval (val, tempvars);
                            break;
                        
                        // The v-component attribute tracks the head node
                        // of a component. Keep it around because it makes
                        // debugging the element tree much simpler.    
                        case "v-component":
                            nw.setAttribute (a, val);
                            break;
                            
                        case "v-if":
                        case "v-for":
                        case "v-eventid":
                        case "v-show":
                            break;
                            
                        default:
                            Vidi.warn ("Unknown attribute: "+a);
                            break;
                    }
                    
                    // Don't copy any other Vidi attribute into the
                    // rendered DOM tree, it's only of internal use.
                    continue;
                }
                
                if (val.startsWith("{{")) {
                    val = val.replace(/{{\s?([^}]*)\s?}}/g,function(m) {
                      let src = m.substr(2,m.length-4);
                      return self.eval(src, tempvars);
                    });
                }
                nw.setAttribute (a, val);
            }
            
            // If there's data in the checksumstr, that means we added
            // event listeners to the node, so we need to make sure
            // that any DOM-reorganizing fuckery happening in the view
            // will distinguish nodes that have the exact same attributes
            // but are bound to different listeners.
            if (checksumstr.length) {
                let tv = {};
                for (let key in tempvars) {
                    if (! key.startsWith('$')) tv[key] = tempvars[key];
                }
                checksumstr += "//" + JSON.stringify(tv);
                nw.setAttribute ("v-eventid", Vidi.checksum(checksumstr));
            }
        }
        
        if (innerhtml) {
            nw.innerHTML = innerhtml;
            return nw;
        }
        
        // Render any children
        for (let cn of orig.childNodes) {
            self.renderTemplate (nw, cn, tempvars);
        }
        
        // If we're a text-node, do things to our textContent.
        if (! orig.childElementCount) {
            let text = orig.textContent;
            if (text) {
                text = text.replace(/{{\s?([^}]*)\s?}}/g,function(m) {
                  let src = m.substr(2,m.length-4);
                  return self.eval(src, tempvars);
                });
                nw.textContent = text;
            }
        }
        return nw;
    }
    
    // ------------------------------------------------------------------------
    // Clones a DOM element (and its children) and adds it as a child to
    // the target element. Attributes and text-data belonging to the element
    // and its children are parsed for moustache-templates.
    // ------------------------------------------------------------------------
    appendClone (into, orig, tempvars, hide) {
        let self = this;
        let nw = self.cloneElement (orig, tempvars);
        if (hide) nw.style.display = "none";
        into.appendChild (nw);
    }
    
    // ------------------------------------------------------------------------
    // Compares two DOM nodes, sans children. If it's possible to do a
    // gentle mutation, like swapping in the right node's attributes,
    // or input-value, goes ahead and does that. Otherwise, returns false.
    // ------------------------------------------------------------------------
    compareNodes (left, right) {
        if (left.nodeType != right.nodeType) {
            return false;
        }
        if (left.tagName != right.tagName) {
            return false;
        }
        if (left.childNodes.length != right.childNodes.length) {
            return false;
        }

        if (! left.childElementCount) {
            if (left.textContent != right.textContent) return false;
        }
        
        if (left.value != right.value) {
            left.value = right.value;
        }
        
        if (left.nodeType == Node.ELEMENT_NODE) {
            // In case of bound events, we should consider the elements
            // un-swappable. Other attributes can be safely transplanted
            // if the element is unbound.
            let lefteventid = left.getAttribute("v-eventid");
            let righteventid = right.getAttribute("v-eventid");
            
            if (lefteventid||righteventid) {
                if (lefteventid != righteventid) return false;
            }
            
            for (let a of left.getAttributeNames()) {
                if (left.getAttribute(a) !== right.getAttribute(a)) {
                   if (right.getAttribute(a) === null) {
                        left.removeAttribute(a);
                    }
                    else {
                        left.setAttribute(a, right.getAttribute(a));
                    }
                }
            }
            for (let a of right.getAttributeNames()) {
                if (left.getAttribute(a) !== right.getAttribute(a)) {
                    if (right.getAttribute(a) === null) {
                        left.removeAttribute(a);
                    }
                    else {
                        left.setAttribute(a, right.getAttribute(a));
                    }
                }
            }
        }

        return true;
    }
    
    // ------------------------------------------------------------------------
    // Transforms a target DOM node to match the output of a new render,
    // keeping subtrees that are unchanged.
    // ------------------------------------------------------------------------
    transplantDom (into, from, isroot) {
        let self = this;
        
        if (! isroot) {
            if (! self.compareNodes (into, from)) {
                if (from.parentNode) {
                    // We swap out the original for an inferior clone, so we
                    // can keep its event listeners, but don't mess up the
                    // number of elements in the original's parent while we're
                    // iterating over them, which is considered bad form.
                    let sup = self.cloneElement (from, {});
                    from.parentNode.replaceChild (sup, from);
                }
                into.parentNode.replaceChild (from, into);
                return;
            }
        }
        
        for (let i=0; i<from.childNodes.length; ++i) {
            self.transplantDom (into.childNodes[i], from.childNodes[i]);
        }
    }
    
    // ------------------------------------------------------------------------
    // Renders out a specific node within the DOM tree of the template.
    // Handles the v-for and v-if attributes, as well as moustache
    // template values inside text nodes.
    // ------------------------------------------------------------------------
    renderTemplate (into, orig, tempvars) {
        let self = this;
        if (orig === undefined) throw new Error ("orig not set");
        if (! tempvars) tempvars = {};

        if (orig.nodeType == Node.ELEMENT_NODE) {
            
            // Handle the v-if attribute
            let vif = orig.getAttribute ("v-if");
            if (vif) {
                if (! self.eval (vif, tempvars)) {
                    // Leave a comment in place of the node, making
                    // sure the node's parent keeps the same number
                    // of child elements.
                    into.appendChild (document.createComment ("v-if"));
                    return;
                }
            }
            
            let hide = false;
            let vshow = orig.getAttribute ("v-show");
            if (vshow) {
                if (! self.eval (vshow, tempvars)) {
                    hide = true;
                }
            }
            
            // Handle the v-for attribute
            let loopfor = orig.getAttribute ("v-for");
            if (loopfor) {
                let split = loopfor.split(" in ");
                let loopval = split[1];
                let rsplit = split[0].split(",");
                let indexvar = null;
                let loopvar = rsplit[0];
                
                if (rsplit.length > 1) {
                    indexvar = rsplit[1];
                }
                
                let data = self.eval(loopval, tempvars);
                let index=0;
                for (let i in data) {
                    let tv = Vidi.copy(tempvars);
                    if (indexvar) tv[indexvar] = i;
                    tv[loopvar] = data[i];
                    self.appendClone (into, orig, tv, hide);
                }
            }
            else {
                self.appendClone (into, orig, tempvars, hide);
            }
        }
        else if (orig.nodeType == Node.TEXT_NODE) {
            let text = orig.textContent;
            if (text) {
                text = text.replace(/{{\s?([^}]*)\s?}}/g,function(m) {
                  let src = m.substr(2,m.length-4);
                  return self.eval(src,tempvars);
                });
                let nw = document.createTextNode(text);
                into.appendChild (nw);
            }
        }
    }
}

// ============================================================================
// CLASS VidiComponent
// -------------------
// Implements a custom HTML tag. Each instance of the defined tag in the DOM
// will be replaced with a template.
// ============================================================================
class VidiComponent {
    constructor (name, def) {
        this.$name = name;
        this.$def = def;
        this.$template = def.template.replace(/^[ \n]*/, "");
        this.functions = def.functions;
        
        Vidi.components[name] = {
            "$name": this.$name,
            "$def": this.$def,
            "$template": this.$template,
            "functions": this.functions,
            "view": null,
            "render": function() {
                throw new Error("render() called on unbound instance");
            }
        }

        if (document.readyState === "complete") {
            this.render();
        }
        else {
            let self = this;
            window.addEventListener("load",function() {
                self.render();
            });
        }
    }
    
    // ------------------------------------------------------------------------
    // Renders out all instances of the custom component in the DOM tree.
    // ------------------------------------------------------------------------
    render() {
        let self = this;
        
        let elements = document.getElementsByTagName (self.$name);
        for (let i = elements.length-1; i>=0; --i) {
            self.renderElement (elements[i]);
        }
    }
    
    // ------------------------------------------------------------------------
    // Render out a top level element
    // ------------------------------------------------------------------------
    renderElement(elm) {
        let self = this;
        let def = self.$def;
        
        var attr = {};
        for (let a in def.attributes) {
            let inattr = elm.getAttribute (a);
            let defattr = def.attributes[a];
            if (defattr == Vidi.Attribute.REQUIRED && !inattr) {
                console.warn ("[Vidi] Found '"+self.$name+"' element with "+
                              "missing required attribute '"+attr+"'",
                              elm);
            }
            
            if (inattr) {
                if (defattr != Vidi.Attribute.STRIP) {
                    attr[a] = inattr;
                }
            }
        }
        
        let children = [];
        if (def.children) {
            for (let tchild of elm.childNodes) {
                if (! tchild.getAttribute) continue;
                let newchild = { attr:{}, innerhtml:"" };
                for (let cattr in def.children) {
                    let attr = tchild.getAttribute (cattr);
                    if (! attr) {
                        if (def.children[cattr] == Vidi.Attribute.REQUIRED) {
                            Vidi.warn ("Instance of component '"+self.$name+
                                       "' missing required child attribute"+
                                       " '"+cattr+"'");
                        }
                    }
                    else {
                        newchild.attr[cattr] = attr;
                    }
                }
                newchild.innerhtml = tchild.innerHTML;
                children.push (newchild);
            }
            elm.innerHTML = "";
        }
        
        let div = document.createElement ("div");
        let inner = elm.innerHTML;
        div.innerHTML = self.$template;
        self.fixAttributes (div, attr, def.functions, inner, null, children);
        
        for (let a in def.attributes) {
            let defattr = def.attributes[a];
            if (defattr == Vidi.Attribute.COPY) {
                if (elm.getAttribute(a)) {
                    div.firstChild.setAttribute(a, elm.getAttribute(a));
                }
            }
        }
        
        let instanceid = 0;
        let elmid = elm.getAttribute("id");
        instanceid = elmid ? elmid : Vidi.uuidv4();

        div.firstChild.setAttribute("v-component", self.$name);
        div.firstChild.setAttribute("v-instance", instanceid);
        if (! Vidi.instances[self.$name]) {
            Vidi.instances[self.$name] = {};
        }
        Vidi.instances[self.$name][instanceid] = { 
            attr: attr,
            children: children,
            state: {},
            functions: self.functions
        };
        
        for (let i=0; i<div.childNodes.length; ++i) {
            let node = div.childNodes[i];
            
            if (elm.nextSibling) {
                elm.parentNode.insertBefore(node,elm.nextSibling);
            }
            else {
                elm.parentNode.appendChild(node);
            }
        }
        
        elm.parentNode.removeChild (elm);
    }
    
    // ------------------------------------------------------------------------
    // Expands any code in attributes, and inner text, handles the
    // 'component-for' attribute, and removes attributes that have no data 
    // after doing the above.
    // ------------------------------------------------------------------------
    fixAttributes (node, attr, funcs, inner, tempvars, children, top) {
        let self = this;
        
        if (node.getAttributeNames) {
            for (let a of node.getAttributeNames()) {
                let val = node.getAttribute(a);
                if (a == "component-if") {
                    if (! self.eval (val, attr, funcs, inner, null, children)) {
                        node.parentNode.removeChild (node);
                        return;
                    }
                    node.removeAttribute (a);
                }
                else if (a == "component-for") {
                    node.removeAttribute (a);
                    let split = val.split(" in ");
                    let splitvar = split[0];
                    let splitindex = null;
                    let tv = {};
                    
                    if (splitvar.indexOf(",") > 0) {
                        let tuple = splitvar.split(",");
                        splitvar = tuple[0];
                        splitindex = tuple[1];
                    }
                    
                    let iter = self.eval (split[1], attr, funcs, inner,
                                          tempvars, children);

                    let nextSibling = node.nextSibling;
                    let parentNode = node.parentNode;
                    
                    for (let obj of iter) {
                        tv[splitvar] = obj;
                        if (splitindex) tv[splitindex] = obj;
                        let nw = node.cloneNode(true);
                        
                        self.fixAttributes (nw, attr, funcs, inner,
                                            tv, children);
                        
                        if (nextSibling) {
                            parentNode.insertBefore(nw,nextSibling);
                        }
                        else {
                            parentNode.appendChild(nw);
                        }
                    }
                    parentNode.removeChild(node);
                    return;
                }
                else {
                    if (val.indexOf("{{") >= 0) {
                        val = val.replace(/{{\s?([^}]*)\s?}}/g,function(m) {
                            let src = m.substr(2,m.length-4);
                            let res = self.eval(src, attr, funcs, inner,
                                                tempvars, children);
                            if (res === undefined || res === null) return "";
                            if (res === true) val = true;
                            return res;
                        });
                    }

                    if (val === true) {
                        node.setAttribute (a, "");
                    }
                    else if (! val) {
                        node.removeAttribute (a);
                    }
                    else node.setAttribute (a, val);
                }
            }
        }
        
        if (! node.childElementCount) {
            let text = "";
            
            if (node.nodeType == Node.TEXT_NODE) {
                text = node.textContent;
            }
            else {
                text = node.innerHTML;
            }

            if (text) {
                text = text.replace(/{{\s?([^}]*)\s?}}/g,function(m) {
                    let src = m.substr(2,m.length-4);
                    return self.eval(src, attr, funcs, inner,
                                     tempvars, children);
                });
                
                node.innerHTML = text;
            }
            return;
        }
        
        // fixAttributes can mess with our child list through loops,
        // so get a list of children to fix in a separate loop.
        let fixlist = [];
        for (let i=0; i<node.childNodes.length; ++i) {
            if (node.childNodes[i].nodeType == Node.TEXT_NODE) continue;
            if (node.childNodes[i].getAttribute("v-component")) continue;
            fixlist.push (node.childNodes[i]);
        }
        
        for (let child of fixlist) {
            self.fixAttributes (child, attr, funcs,
                                inner, tempvars, children);
        }
        
    }
    
    // ------------------------------------------------------------------------
    // Execute a render function defined for the template.
    // ------------------------------------------------------------------------
    eval (txt, attr, func, inner, tempvars, children) {
        let self = this;
        let src = "(function(){ "+
                  "return function(attr,func,innerhtml,children,__tmp) {";
        for (let fid in func) {
            src += "var "+fid+" = func."+fid+";";
        }
        if (tempvars) for (let tvid in tempvars) {
            src += "var "+tvid+" = __tmp."+tvid+";";
        }
        
        src += "return ("+txt+"); ";
        src += "}})()";
        
        try {
            return eval(src)(attr,func,inner,children, tempvars);
        }
        catch (e) {
            Vidi.warn ("Parse error in component '"+self.name+"': "+e);
            Vidi.warn ("text: "+src);
            return null;
        }
    }
}

// ============================================================================
// BASE OBJECT
// ============================================================================
Vidi = {
    View:VidiView,
    Component:VidiComponent,
    Attribute:{
        OPTIONAL: 1,
        REQUIRED: 2,
        COPY: 3,
        STRIP: 4
    },
    instances:{},
    components:{},
    views:{}
}

// ============================================================================
// Copy-by-value helper function.
// ============================================================================
Vidi.clone = function(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy;
    if (typeof (obj) == "function") return obj;
    if (typeof(obj.constructor) == "function") {
        try {
            copy = obj.constructor();
        }
        catch (e) {
            console.warn ("[Vidi] funny:",e);
            copy = {}
        }
    }
    else {
        copy = {};
    }
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) {
            if (typeof obj[attr] == "object") {
                copy[attr] = Vidi.clone(obj[attr]);
            }
            else copy[attr] = obj[attr];
        }
    }
    return copy;
}

// ============================================================================
// Create a shallow clone of an object, keeping the member variables
// as references, but allowing mutations to the actual member list
// separated from the original.
// ============================================================================
Vidi.copy = function(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    if (typeof (obj) == "function") return obj;
    var copy = {};
    for (var attr in obj) {
        copy[attr] = obj[attr];
    }
    return copy;
}

// ============================================================================
// Generate a uuid (used for tracking component instances)
// ============================================================================
Vidi.uuidv4 = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================================
// Generate simple hash for a string. Used when setting up the
// EventListeners for a DOM node, to keep track of unique combinations of
// event handling code fragments and closure data.
// ============================================================================
Vidi.checksum = function(s) {
    let hash=0;
    for (let i=0; i < s.length; i++) {
      let chr = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    if (hash<0) hash = -(hash-1);
    let code = hash.toString(16).padStart(8,'0');
    return code.substr(0,4) + "-" + code.substr(4);
}

// ============================================================================
// Log helper
// ============================================================================
Vidi.warn = function(str) {
    console.warn ("[Vidi] "+str);
}

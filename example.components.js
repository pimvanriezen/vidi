// ============================================================================
// Implements <v-button>
// ---------------------
// This component illustrates how to allow a view to set interactive
// parameters that have a more fundamental effect on the component's
// DOM tree than just a change of text. End users can declare something like
//
//      <button badge="{{unreadMessages()}}">Foo</button>
//
// and the badge will be kept in sync with the view.
//
// Attributes:
//    id        The id of the button node
//    icon      The name of an icon image in the 'icon' subdirectory.
//    cb        A statement to execute on click
//    require   A statement that, if evaluated to false, disabled the button
//    badge     If set at all, make room for a number badge. If the value
//              is non-zero, display the number badge.
//    class     Any extra class statements on top of the classes 'withicon'
//              and 'badged' that the button may carry depending on
//              configuration.
// ============================================================================
new Vidi.Component("v-button", {
    attributes:{
        "id":       Vidi.Attribute.COPY,
        "icon":     Vidi.Attribute.OPTIONAL,
        "cb":       Vidi.Attribute.OPTIONAL,
        "require":  Vidi.Attribute.OPTIONAL,
        "badge":    Vidi.Attribute.OPTIONAL,
        "class":    Vidi.Attribute.OPTIONAL,
        "v-if":     Vidi.Attribute.COPY,
        "v-for":    Vidi.Attribute.COPY
    },
    template:`
        <button v-on:click="{{attr.cb}}"
                class="{{makeClass(attr)}}"
                v-bind:disabled="{{makeDisabled(attr)}}"
                style="{{makeStyle(attr)}}">
            <div style="position:relative;">
                <span>{{innerhtml}}</span>
            </div>
            <div component-if="attr.badge"
                 v-bind:class="{{attr.badge}}==0?'badge':'badge nonzero'">
                    {{attr.badge}}
            </div>
        </button>
    `,
    functions:{
        makeStyle:function(attr) {
            if (attr.icon) {
                return "background-image:url('icon/" + attr.icon + "');";
            }
        },
        makeClass:function(attr) {
            let classlist = [];
            if (attr.icon) classlist.push("withicon");
            if (attr.badge) classlist.push("badged");
            if (attr.class) classlist.push(attr.class);
            return classlist.join(' ');
        },
        makeDisabled:function(attr) {
            if (attr.require) {
                return "!("+attr.require+")";
            }
        }
    }
});

// ============================================================================
// Implements <v-table>
// --------------------
// This component illustrates the use of child-nodes to make a component
// that needs flexibility in the number of items it operates on. In this
// case, we are looking for nodes under the <v-table> declarations with
// a number of parameters in their attributes, and possibly a text
// component. In the view, this would look something like this:
//
//      <v-table rows="someViewVar">
//          <v-column title="id">{{id}}</v-column>
//          <v-column title="name">{{row.name}}</v-column>
//      </v-table>
//
// The 'component-for' loop declared in the template is executed when
// an instance of the component is instantiated, and loops solely over
// the children. The 'v-for' loop is exported as is and will be handled
// by whatever view embeds the instance.
// ============================================================================
new Vidi.Component("v-table", {
    attributes:{
        "id":       Vidi.Attribute.COPY,
        "class":    Vidi.Attribute.COPY,
        "v-if":     Vidi.Attribute.COPY,
        "rows":     Vidi.Attribute.REQUIRED,
        "width":    Vidi.Attribute.COPY,
        "max-width":Vidi.Attribute.OPTIONAL,
        "sort-key": Vidi.Attribute.OPTIONAL
    },
    children:{
        "v-column":{
            "title":    Vidi.Attribute.REQUIRED,
            "key":      Vidi.Attribute.OPTIONAL,
            "align":    Vidi.Attribute.OPTIONAL,
            "width":    Vidi.Attribute.OPTIONAL
        }
    },
    template:`
        <table cellspacing="5" border="0" style="{{makeStyle(attr)}}">
          <tr>
            <th component-for="col in children['v-column']"
                   v-on:click="$component.click($instance,'{{col.attr.key}}')"
                        class="{{col.attr.key?'clickable':''}}"
                        align="{{col.attr.align}}">
              <span v-bind:style="$component.sortStyle($instance,
                                                      '{{col.attr.key}}')">
                {{col.attr.title}}
              </span>
            </th>
          </tr>
          <tr v-for="row,id in $component.sort($instance, {{attr.rows}})">
            <td component-for="c in children['v-column']"
                        width="{{c.attr.width}}"
                        align="{{c.attr.align}}">
              {{c.innerhtml}}
            </td>
          </tr>
        </table>
    `,
    functions:{
        makeStyle:function(attr) {
            if (attr["max-width"]) {
                return "max-width:"+attr["max-width"]+"px;";
            }
        },
        
        click:function(instance,key) {
            if (! key) {
                return;
            }
            instance.state.sortKey = key;
            instance.render();
        },
        
        sortStyle:function(instance,key) {
            let sortKey;
            if (! instance.state.sortKey) {
                if (instance.attr["sort-key"]) {
                    instance.state.sortKey = instance.attr["sort-key"];
                }
                else {
                    instance.state.sortKey = 
                        instance.children["v-column"][0].attr.key;
                }
            }
            sortKey = instance.state.sortKey;
            if (key == sortKey) return "text-decoration: underline;";
            return ""
        },
        
        sort:function(instance,rows) {
            let sortKey;
            if (! instance.state.sortKey) {
                if (instance.attr["sort-key"]) {
                    instance.state.sortKey = instance.attr["sort-key"];
                }
                else {
                    instance.state.sortKey = 
                        instance.children["v-column"][0].attr.key;
                }
            }
            sortKey = instance.state.sortKey;
            let sorted = {};
            
            if (sortKey == "id") {
                Object.keys(rows).sort().forEach(function(key) {
                    sorted[key] = rows[key];
                });
            }
            else if (sortKey.startsWith ("row.")) {
                let k = sortKey.substr(4);
                let skeys = Object.keys(rows).sort(function (a,b) {
                    return rows[a][k] > rows[b][k];
                });
                skeys.forEach (function (key) {
                    sorted[key] = rows[key];
                });
            }
            
            return sorted;
        }
    }
});

// ============================================================================
// Implements <v-view>
// -------------------
// Uninteresting wrapper.
// ============================================================================
new Vidi.Component("v-view", {
    attributes:{
        "id":Vidi.Attribute.COPY
    },
    template:`
        <v-view id="{{attr.id}}">
            {{innerhtml}}
        </v-view>
    `,
    functions:{}
});

// ============================================================================
// Implements <v-textinput>
// ------------------------
// Combines an input and a label. This component also illuestrates how to
// route events back into the component. Whenever a view executes a code-
// fragment within the boundaries of a component, two extra variables
// are available to aid with this: "$component", and "$instance". The first
// returns the component's functions object, the second contains meta-
// information about the specific instance of the component, in the form
// of an object with three keys:
//
//      view        Points to the view the instance is embedded in
//      attributes  Points to the attributes passed to that instance
//      children    Points to the children passed to that instance
//
// Together with the $event variable available in a view's on:event
// attribute, we use this to implement special handling for the
// escape-key, which will clear the input -and- the view. 
// ============================================================================
new Vidi.Component("v-textinput", {
    attributes:{
        "id":Vidi.Attribute.REQUIRED
    },
    template:`
        <div>
            <label for="{{attr.id}}">{{innerhtml}}</label>
            <input      name="{{attr.id}}" spellcheck="false"
                   v-on:keyup="$component.keyUp($instance,$event)"
                      v-model="{{attr.id}}"
                   v-on:input="{{exports.cb}}"/>
        </div>
    `,
    functions:{
        keyUp:function(instance, event) {
            if (event.keyCode != 27) return;
            let model = instance.attr.id;
            instance.view[model] = "";
            event.target.value = "";
        }
    }
});

// ============================================================================
// Implements <v-form>
// -------------------
// Another boring wrapper
// ============================================================================
new Vidi.Component("v-form", {
    attributes:{
        "id":Vidi.Attribute.COPY,
        "cb":Vidi.Attribute.EXPORT
    },
    template:`
        <form action="javascript:void(0);">
          {{innerhtml}}
        </form>
    `
});           

// ============================================================================
// Implements <v-secret>
// ---------------------
// Wraps a little easter egg.
// ============================================================================
new Vidi.Component("v-secret", {
    attributes:{
        "require":Vidi.Attribute.REQUIRED,
        "show":Vidi.Attribute.REQUIRED,
    },
    template:`
        <div style="position:absolute; bottom: 8px;">
            <a v-if="!{{attr.require}}" class="clickable"
               v-on:click="{{attr.show}}">
                <tt>π</tt>
            </a>
            
            <p v-if="{{attr.require}}">
                {{innerhtml}}
            </p>
        </div>
    `,
    functions:{}
});

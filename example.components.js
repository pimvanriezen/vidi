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
                class="{{attr.icon?'withicon ':''}}{{attr.class}}"
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
        makeDisabled:function(attr) {
            if (attr.require) {
                return "!("+attr.require+")";
            }
        }
    }
});

new Vidi.Component("v-table", {
    attributes:{
        "id":       Vidi.Attribute.COPY,
        "class":    Vidi.Attribute.COPY,
        "v-if":     Vidi.Attribute.COPY,
        "rows":     Vidi.Attribute.REQUIRED,
        "width":    Vidi.Attribute.COPY,
        "max-width":Vidi.Attribute.OPTIONAL
    },
    children:{
        "title":    Vidi.Attribute.REQUIRED,
        "align":    Vidi.Attribute.OPTIONAL,
        "width":    Vidi.Attribute.OPTIONAL
    },
    template:`
        <table cellspacing="5" border="0" style="{{makeStyle(attr)}}">
          <tr>
            <th component-for="col in children"
                align="{{col.attr.align}}">{{col.attr.title}}</th>
          </tr>
          <tr v-for="id,row in {{attr.rows}}">
            <td component-for="c in children"
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
        }
    }
});

new Vidi.Component("v-view", {
    attributes:{
        "id":Vidi.Attribute.COPY
    },
    template:`
        <v-view id="{{attr.id}}" style="display:none;">
            {{innerhtml}}
        </v-view>
    `,
    functions:{}
});

new Vidi.Component("v-textinput", {
    attributes:{
        "id":Vidi.Attribute.REQUIRED
    },
    template:`
        <div>
            <label for="{{attr.id}}">{{innerhtml}}</label>
            <input name="{{attr.id}}"
                   v-on:keyup="component.keyUp(instance,event)"
                   v-model="{{attr.id}}"/>
        </div>
    `,
    functions:{
        keyUp:function(instance, event) {
            if (event.keyCode != 27) return;
            let model = instance.attributes.id;
            instance.view[model] = "";
            event.target.value = "";
        }
    }
});

new Vidi.Component("v-form", {
    attributes:{
        "id":Vidi.Attribute.COPY
    },
    template:`
        <form action="javascript:void(0);">
          {{innerhtml}}
        </form>
    `
});           

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
                v-on:setbadge="component.setBadge(instance,event)"
                class="{{attr.icon?'withicon ':''}}{{attr.class}}"
                u-badge="{{attr.badge}}"
                v-bind:disabled="{{makeDisabled(attr)}}"
                style="{{makeStyle(attr)}}">
            <div style="position:relative;">
                <span>{{innerhtml}}</span>
            </div>
            <div component-if="attr.badge" class="badge">
                    {{makeBadge(attr)}}
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
        },
        makeBadge:function(attr) {
            if (attr.badge) {
                return '{{'+attr.badge+'}}';
            }
            return '0';
        },
        setBadge:function(instance,event) {
            if (! event.detail || event.detail.value === undefined) {
                return;
            }
            let value = event.detail.value;
            let div = event.target.querySelector(".badge");
            if (! div) return;
            
            if (value) {
                div.classList.add ("nonzero");
            }
            else {
                div.classList.remove ("nonzero");
            }
            div.innerHTML = value;
            instance.view[instance.attributes.badge] = value;
            console.log ("Updated badge");
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
            <input name="{{attr.id}}" v-model="{{attr.id}}"/>
        </div>
    `,
    functions:{}
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

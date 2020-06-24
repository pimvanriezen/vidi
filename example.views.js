new Vidi.View("user", {
    model:{
        title:"My page",
        showsecrets:false,
        secrets:0,
        users:{
            root:{
                name:"System Administrator",
                uid:0,
                groups:["wheel"]
            },
            john:{
                name:"John Deau",
                uid:501,
                groups:["users","john","dev"]
            },
            steve:{
                name:"Steve Deau",
                uid:502,
                groups:["users","steve"]
            }
        },
        newid:"",
        newname:""
    },
    methods:{
        remove:function(id) {
            if (id == "root") {
                alert("Refusing delete of root account");
                return;
            }
            delete this.view.users[id];
        },
    
        add:function() {
            if (! this.view.newid) {
                alert("Invalid data");
                return;
            }
            if (this.view.users[this.view.newid]) {
                alert("Error: user already exists");
                return;
            }

            let newuid = 500;
            for (let i in this.view.users) {
                let user = this.view.users[i];
                if (user.uid >= newuid) newuid = user.uid+1;
            }
        
            this.view.users[this.view.newid] = {
                uid:newuid,
                name:this.view.newname,
                groups:["users",this.view.newid]
            }
        
            this.view.newname = "";
            this.view.newid = "";
            this.$("[name='newid']").focus();
        }
    }
});

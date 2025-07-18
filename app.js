// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate=require("mongoose-findorcreate");
const ejs = require("ejs");
//making server https for facebook login method to work... no idea how it works but we used openssl or something and i think i should delete whatever the fajita it created but doesnt?
const fs = require('fs');
const https =  require("https");


// const encrypt = require("mongoose-encryption");

const app = express();
https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app);

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(session({
  secret:process.env.SECRET,
  resave:false,
  saveUninitialized:false,
  cookie:{}
}));

app.use(passport.initialize());
app.use(passport.session());

// mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser:true, useUnifiedTopology:true});
mongoose.connect(process.env.ATLAS, {useNewUrlParser:true, useUnifiedTopology:true});
// mongoose.set("useCreateIndex", true);
const userSchema = new mongoose.Schema({email:String, password:String, googleID:String, facebookID:String, secret:String});
// userSchema.plugin(encrypt, {encryptionKey:process.env.SECRET, encryptedFields:['password']});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
userSchema.plugin(passportLocalMongoose, {usernameUnique: false});
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function(user, done){
  // console.log(user);
  done(null, user.id);
});
passport.deserializeUser(function(id, done){
  User.findById(id, function(err, user){
    // console.log(user, id);
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID:process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/authentication"
}, function(accessToken, refreshToken, email, cb) {
    User.findOrCreate({ googleID: email.id, email:email._json.email, username:email._json.name}, function (err, user) {
      // console.log(profile.id);
      console.log(user);
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
  clientID: process.env.APP_ID,
  clientSecret: process.env.APP_SECRET,
  callbackURL:"http://localhost:3000/auth/facebook/authentication"
},
function(accessToken, refreshToken, profile, done){
  console.log(profile);
  User.findOrCreate({facebookID:profile.id}, function(err, user){
    if(err){return done(err);}
    done(null, user);
  });
}));


  app.listen(3000, function(){
  console.log("Server listening on port 3000");
});


app.route("/auth/google")
  .get(passport.authenticate("google", {scope:["profile", "email"]}));

app.get("/auth/google/authentication",
  passport.authenticate("google", { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

  app.get("/auth/facebook", passport.authenticate("facebook", {scope:["public_profile"]}));

 app.get('/auth/facebook/authentication', passport.authenticate('facebook', { successRedirect: '/secrets', failureRedirect: '/login'}));

app.get("/", function(req, res){
  if(req.isAuthenticated()){
    res.render("secrets");
  }else{
    res.render("home");
  }

});

app.get("/submit", function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res){
  const submittedSecret = req.body.secret;
  User.findById(req.user._id, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        foundUser.secret = submittedSecret;
        foundUser.save(function(err){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});


app.get("/secrets", function(req,res){
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
  if(req.isAuthenticated()){
    User.find({"secret":{$ne:null}}, function(err, resultUsers){
      if(err){
        console.log(err);
      }else{
        res.render("secrets", {usersWithSecrets:resultUsers});
      }
    });
  }else{
    res.redirect("/login");
  }
});

app.route("/login")
  .get(function(req, res){
    res.render("login", {message:""});
  })
  .post(passport.authenticate("local"), function(req, res){
    // const username = req.body.username;
    // const password = req.body.password;
    // User.findOne({email:username}, function(err, userFound){
    //   if(userFound){
    //     bcrypt.compare(password, userFound.password, function(err, result){
    //       if(result===true){
    //         res.render("secrets");
    //       }
    //     });
    //
    //   }else{
    //     res.render("login", {message:"Invalid email or password. Please try again."})
    //   }
    // });
    // var newUser = new User({username: req.body.username, password:req.body.password});
    // req.login(newUser, function(err){
    //   if(err){
    //     console.log(err);
    //   }else{
    //     passport.authenticate("local")(req, res, function(){
    //       res.redirect("/secrets");
    //     });
    //   }
    // });
    res.redirect("/secrets");
  });

app.route("/register")
  .get(function(req, res){
    res.render("register");
  })
  .post(function(req, res){
    // bcrypt.hash(req.body.password, saltRounds, function(err, hash){
    //   const newUser = new User({
    //     email:req.body.username,
    //     password: hash
    //   });
    //   newUser.save(function(err){
    //     if (err){
    //       res.send(err);
    //     }else{
    //       res.render("login", {message:""});
    //     }
    //   });
    // });
    var newUser = new User({username: req.body.username, email:req.body.username});
    User.register(newUser, req.body.password, function(err, user){
      if (err){
        console.log(err);
        res.redirect("/register");
      }else{
        res.redirect("/login");
        }

      });
      });

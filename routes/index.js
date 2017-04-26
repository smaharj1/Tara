var express = require('express');
var request = require('request');
var removePunctuation = require('remove-punctuation');
var sw = require('stopword')
var router = express.Router();
var activity = require('./activity.js')

var verbs = ['VBP', 'VBZ', 'VBD', 'VBG','VBN', 'VBP'];
var nouns = ['NN','NNP','NNPS','NNS'];
var shopCategory = ['buy', 'purchase', 'shop', 'redeem'];
var watchCategory = ['watch', 'view', 'see', 'follow']
var outdoorCategory = ['play', 'visit', 'travel', 'hike', 'trek', 'walk', 'run', 'climb', 'fly', 'ride', 'tour', 'trip', 'sail', 'bike']
var eatCategory = ['eat', 'dine']
var categories = ["Really into shopping? Maybe hit the nearest mall?/n Or Amazon to the rescue!", 
                    "Media/Film geek! Hit the nearest AMC or Netflix and Chill?", 
                    "Hiking and aventure is the main goal of like? Aren't there trails or reservation nearby? Hit the Mt. Everest!",
                     "Meat lover or eat lover? #foodPorn"]



function checkVerb(verb, i, callBack) {

  var url = "http://api.ultralingua.com/api/stems/english/" + verb + "?partofspeech=verb";

  request(url, function (err, response, body) {
    if (!err && response.statusCode == 200) {
      var root = JSON.parse(response.body)[0].root
      callBack(i,root);
      return;
    } else {
      //console.log(response.body)
      callBack(i, null);
    }
  })
}

function getSpellCheckedText(text, callBack) {
  //var text = "Ha vefun triingf owt theBin gspeller by typying a sentance or clcking teh sampels bellow";
  //console.log(text);

  var requestOptions = {
    url: "https://api.cognitive.microsoft.com/bing/v5.0/spellcheck/?",
    qs: {
      // Request parameters
      "text": text,
    },
    headers: {
      "Ocp-Apim-Subscription-Key": "70f1e020fbcd466a9bbe77461b091256"
    }
  }

  request(requestOptions, function (err, response, body) {
    if (!err && response.statusCode == 200) {
      var returnText = text;
      var tokens = text.flaggedTokens;
      for (var i in tokens) {
        returnText = returnText.replace((tokens[i].token).toString(), (tokens[i].suggestions[0].suggestion).toString())
      }
      console.log(returnText);
      callBack(returnText);
      return;
    }
  })
}

function analyzeText(detect, callBack) {
  //var text = "Its a great Monday because I bought a really cool shirt with a really cool GUcci jacket";
  //var text = "it was great watching pyscho with friend. I loved being scared with them. I want this blue dress from Chanel so bad. I wish I was not poor. This pair of shoes from Kenneth Cole is the finest I have seen so far. This is the funniest thing ever. #meme I had an amazing time hiking the ramapo trails today. Thank you friends for coming along. Hiking ramapo trails again. I am very excited. Going to the rocky mountain hiking with my girlfriend."
//console.log(detect);
  //detect = detect.join(" ");
  var text = detect;
  getSpellCheckedText(text, function (returnText) {
    text = returnText;
    var text = getTokens(returnText).join(' ');
    console.log("Before analyzing: " + text);
    var requestOptions = {
      //url: "https://westus.api.cognitive.microsoft.com/text/analytics/v2.0/"+detect,
      url: "https://westus.api.cognitive.microsoft.com/linguistics/v1.0/analyze",
      method: "POST",
      json: {
        "language": "en",
        "analyzerIds": ["22a6b758-420f-4745-8a3c-46835a67c0d2"],
        "text": text
      },
      headers: {
        "Content-Type": "application/json",
        //"Ocp-Apim-Subscription-Key": "SENTIMENT ANALYSIS SUBSCRIPTION KEY GOES HERE"
        "Ocp-Apim-Subscription-Key": "99aa200fbbc64332b28e92a1a22c26c6"
      }
    }

    request(requestOptions, function (err, response, body) {
      if (!err && response.statusCode == 200) {
        //console.log(JSON.stringify(response.body[0]['result'][0]))
        tobeParsed = response.body[0]['result'][0];
        var arr = tobeParsed.split(/[\(|\)| ]+/);
        var neededVerb = [];
        console.log("THis is the array after split")
        console.log(arr);
        var all = [];
        var lastVerbIndex = -1;

        for (var i = 0; i < arr.length; i++) {
          if (verbs.indexOf(arr[i]) > -1) {
            var index = getIndex(arr[i+1], all);

            if (index == -1) {
              console.log("Adding verb activity " + arr[i+1]);
              var ob = new activity(arr[i+1]);
              all.push(ob);
              lastVerbIndex = all.length - 1;
            }
            else {
              console.log("Increasing count for verb " + all[index].name)
              all[index].increaseCount();
              lastVerbIndex = index;
            }
          }
          else if (nouns.indexOf(arr[i])>-1){
            if (lastVerbIndex != -1) {
              all[lastVerbIndex].addDescription(arr[i+1]);
            }
            else {
              console.log("Adding verb activity " + arr[i+1]);
              var ob = new activity(arr[i+1]);
              all.push(ob);

              // Just ignore
            }
          }

/*
            if (i + 1 < arr.length) {
              neededVerb.push(arr[i + 1]);
            }*/
          }
        


        //console.log(neededVerb.join(","));
        //callBack(neededVerb);
        callBack(all);
      }

      else {
        console.log(err, response);
      }
    });

  });




}



function getTokens(keywords) {
  var tokens = removePunctuation(keywords).split(" ");
  tokens = sw.removeStopwords(tokens)
  console.log(tokens);
  return tokens;

}

router.get('/',function (req,res, next) {

  res.render('index', {title: "Tara"});
})

/* GET home page. */
router.post('/analyze', function (req, res, next) {
  console.log(req.body)
  
  analyzeText(req.body.data, function (x) {

    // X is the tree
    var test = x;
    var i = 0;

    
    
    var p = function (i,y) {
      
      if (i < test.length) {
        if(y) test[i-1].name=y;
        checkVerb(test[i].name,++i, p);
      } else {
        if (y) test[i-1].name=y;

        var categorizedVals = normalizeList(test);

        // sort each categories.
        for (var j in categorizedVals) {
          var category = categorizedVals[j];
          
          if (category) {
            category.sort(function (a, b) {
              return a.count > b.count;
            })
          }
        }


        // Test print
        console.log(JSON.stringify(categorizedVals));

        categorizedVals.sort(function(a,b){
          a.count > b.count;
        })
        
        var result = [];
        var max = categorizedVals[0].count;
       for(i in categorizedVals){

         
         if(categorizedVals[i].count < max) break;

         if (categorizedVals[i][0] != undefined ) {
          var temp = categorizedVals[i][0].name
          console.log("Checking for " + temp);
          if( shopCategory.indexOf(temp)>-1) {
            result.push(categories[0]);
            console.log("Shop!!");
            }
          else if( watchCategory.indexOf(temp)>-1) result.push(categories[1])
          else if( shopCategory.indexOf(temp)>-1) result.push(categories[2])
          else result.push(categories[3]);
         }
       }
       console.log(result)
        res.send(result);

        
      }
    }
    checkVerb(test[i].name,++i,p);




  });
  //
  //var test = ["bought","ate"];
 


});

function getMax(givenList) {
  var maxi = givenList[0];
  for (var i in givenList) {
    if (givenList[i].count > maxi.count) {
      maxi = givenList[i];
    }
  }

  return maxi;
}

function getIndex(term, givenList) {
  for (var i in givenList) {
    if (givenList[i].name == term) return i;
  }
  return -1;
}

function normalizeList(verbGiven) {
  var catList = [[],[],[],[]];
  //console.log(verbGiven);


  for (var index in verbGiven) {
    var item = verbGiven[index];
    var itemName = item.name;
    //console.log("Item name normalization: " + itemName);

    if (shopCategory.indexOf(itemName)>-1) {
      catList[0].push(item);
    } else if (watchCategory.indexOf(itemName)>-1) {
      catList[1].push(item);
    } else if (outdoorCategory.indexOf(itemName) >-1) {
      catList[2].push(item);
    } else if (eatCategory.indexOf(itemName)>-1){
      catList[3].push(item);
    }

  }

  return catList;
}

module.exports = router;
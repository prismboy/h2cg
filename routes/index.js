/**
 *
 */
/*eslint-disable no-unused-params */
const context = require('../utils/context');
const crypto = require("crypto");

const howtoTrash = (clazz) => {
	return new Promise((resolve, reject) => {
		resolve(context.getMsgId(clazz)
		.then((resolv)=>{
			return context.getMessage(resolv);
		})
		.catch((reject)=>{
			return reject;
		}));
	});
};

const classify = (path,req) => {
	return new Promise((resolve, reject) => {
		var params = {
			images_file: context.fs.createReadStream(path),
			classifier_ids: context.classifierIds,
			threshold: 0.75
		};
		context.visualRecognition.classify(params).then(response => {
			var classifiers = response.images[0].classifiers;
			var classArray = new Array();
			var scores = new Array();
			var topClass="";
			var topScore=0;
			for(var i=0;i<classifiers.length;i++){
				for(var j=0;j<classifiers[i].classes.length;j++){
					var clazz = classifiers[i].classes[j].class;
					var score = classifiers[i].classes[j].score;
					classArray.push(clazz);
					scores.push(score);
					if(topScore < score){
						topClass = clazz;
						topScore = score;
					}
				}
			}

			var results = {
				'classes': classArray,
				'scores': scores,
				'messages': [],
				'topClass': topClass,
				'topScore': topScore,
				'type' : req.file.mimetype,
				'image': context.fs.readFileSync(path, 'base64')
			};
			var callFunc = [];
			for(var inx in classArray) {
				callFunc.push(howtoTrash(classArray[inx]));
			}
			var promise = Promise.all(callFunc);
			promise.then((resolv) => {
				results.messages = resolv;
				resolve(results);
			});
		}).catch(err => {
			console.log('error: ',err);
			reject(err);
		});
	});
};

const sumMessage = (results) => {
	var sumMsgs = [];
	var preMsgid = [];
	for(var i=0;i<results.length;i++){
		if(results[i].msgid==="-"){
			continue;
		}
		if(preMsgid.indexOf(results[i].msgid)<0){
			sumMsgs.push({"kind":results[i].kind,"description":results[i].description});
			preMsgid.push(results[i].msgid);
		}
	}
	return sumMsgs;
};

const verifyRequest = (req) => {
	var key = req.headers['x-line-signature'];
	if(key===undefined){
		return false;
	}
	var hmac = crypto.createHmac('sha256', key.toString());
	hmac.update(JSON.stringify(req.body));
	console.log('# Digest: '+hmac.digest('base64'));
	console.log('# Signature: '+key);
	/*
	return hmac.digest('base64') === key.toString();
	*/
	return true;
};

const callLineMessageApi = (options, callback) => {
	context.request(options, (error, response, body) => {
		if(!error && response.statusCode === 200) {
			callback(body, response);
		} else {
			console.log('Error: ' + JSON.stringify(error));
			console.log('Response: ' + JSON.stringify(response));
		}
	});
};

// テキストメッセージを送信する。
const pushMsg = (text, packageId, stickerId, event) => {
    // 送信データを作成する。
    var data = {
        "to": event.source.userId,
        "messages": [
            {
                "type": "text",
                "text": text
            }
        ]
    };

    if(packageId!=="" && stickerId!==""){
      data.messages.push(
        {
          "type": "sticker",
          "packageId": packageId,
          "stickerId": stickerId
        }
      );
    }

    //オプションを定義する。
    var options = {
        method: 'POST',
        url: 'https://api.line.me/v2/bot/message/push',
        headers: context.headers,
        json: true,
        body: data
    };

    // LINE BOT API: Sending messages (Text)
    callLineMessageApi(options, function (body) {
        console.log(body);
    });
};

/** LINE Bot用 */
const classify4Line = (path) => {
	return new Promise((resolve, reject) => {
		var params = {
			images_file: context.fs.createReadStream(path),
			parameters : {
				classifier_ids: context.classifierIds,
				threshold: 0.75
			}
		};
		context.visualRecognition.classify(params, (err, response) => {
			if(err){
				console.log('Visual Recognition Error: ',err);
				reject(err);
			} else {
				var classifiers = response.images[0].classifiers;
				var classArray = new Array();
				var scores = new Array();
				for(var i=0;i<classifiers.length;i++){
					for(var j=0;j<classifiers[i].classes.length;j++){
						var clazz = classifiers[i].classes[j].class;
						var score = classifiers[i].classes[j].score;
						classArray.push(clazz);
						scores.push(score);
					}
				}

				var results = {
					'classes': classArray,
					'scores': scores,
					'messages': []
				};
				var callFunc = [];
				for(var inx in classArray) {
					callFunc.push(howtoTrash(classArray[inx]));
				}
				var promise = Promise.all(callFunc);
				promise.then((resolv) => {
					results.messages = resolv;
					resolve(results);
				},(reject)=>{console.log('Reject: '+reject);});
			}
		});
	});
};

exports.upload = (req, res) => {
	var target_path, tmp_path;
	tmp_path = req.file.path;
	target_path = '../tmp/' + req.file.originalname;
	classify(tmp_path, req)
		.then((resolve)=>{
			resolve.sumMsgs = sumMessage(resolve.messages);
			res.render('result', resolve);
			context.fs.unlink(target_path, ()=>{if(err)throw err;});
		},
		(reject)=>{console.log(reject);}
	);
	/*
	context.fs.rename(tmp_path, target_path, (err)=>{
		if(err){
			throw err;
		}
		context.fs.unlink(tmp_path, ()=>{
			if(err){
				throw err;
			}
		});
	});*/
};

exports.callback = (req, res) => {
	if(!verifyRequest(req)){
		console.log('検証エラー: 不正なリクエスト');
		res.sendStatus(500);
		return;
	}
	if(req.body === undefined) {
		console.log('Request body is nothing!');
		res.sendStatus(200);
		return;
	}

	if(req.body.events === undefined){
		console.log('# Request body: '+JSON.stringify(req.body));
		res.sendStatus(200);
		return;
	}

	var event = req.body.events[0];
	if(event.message.type === "image"){
		var options = {
			"method": "GET",
			"url": "https://api.line.me/v2/bot/message/" + event.message.id + "/content",
			"encoding": null,
			"headers": {
				"Authorization": context.headers.Authorization
			}
		};
		callLineMessageApi(options, (body, response) => {
			var contentType = response.headers['content-type'].replace("image\/","");
			var reqId = response.headers['x-line-request-id'];
			var target_path = "../tmp/" + reqId + "." + contentType;
			context.fs.writeFileSync(target_path, body);
			pushMsg("画像を解析しています","","",event);
			classify4Line(target_path).then((resolve)=>{
				var sumMsgs = sumMessage(resolve.messages);
				if(sumMsgs.length>0){
				var msg = "";
					for(var i=0; i<sumMsgs.length;i++){
						if(msg!==""){
							msg+='\n\n';
						}
						msg+='['+sumMsgs[i].kind+']\n'+sumMsgs[i].description;
					}

					pushMsg(msg, "1", "13", event);
				} else {
					pushMsg("判別できませんでした","1","107",event);
				}
			},(reject)=>{console.log('Error:'+JSON.stringify(reject));});
			context.fs.unlink(target_path,(err) => {
				if(err) console.log(JSON.stringify(err));
			});
		});
	} else if(event.message.type === "text" && event.message.text === "Hello, world"){
        res.sendStatus(200);
	} else {
		pushMsg("画像を送ってね。","1","107",event);
	}
};

exports.index = (req, res) => {
	res.render('index');
};


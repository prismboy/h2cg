/**
 * コンテキスト
 *
 * @module utils/context
 * @author Akamatsu
 */

// 環境変数を取得する。
//const cfenv = require('cfenv');
//const appEnv = cfenv.getAppEnv();
require('dotenv').config();

/** 環境変数 */
//exports.appEnv = appEnv;

/** File System */
const fs = require('fs');
exports.fs = fs;

/** Path */
exports.path = require('path');

/** Request */
exports.request = require('request');

/** Watson Visual Recognition */
const VisualRecognitionV3 = require('ibm-watson/visual-recognition/v3');
const params = {
    version: '2018-03-19',
    headers : {
        'Accept-Language': 'en'
    }
};
const visualRecognition = new VisualRecognitionV3(params);
exports.visualRecognition = visualRecognition;
var classifierIds = [];
if (process.env.CLASSIFIER_IDS !== null) {
	classifierIds = process.env.CLASSIFIER_IDS.split(",");
} else {
	classifierIds = ["default"];
}
exports.classifierIds = classifierIds;

/** Cloudant NoSQL DB */
const Cloudant = require('@cloudant/cloudant');
const auth = {
	url: process.env.CLOUDANT_URL,
	plugins: {
		iamauth: {
			iamApiKey: process.env.CLOUDANT_APIKEY
		}
	}
};
const cloudant = Cloudant(auth);
const classdb = cloudant.db.use("classdb");
const messagedb = cloudant.db.use("messagedb");

exports.getMsgId = (className) => {
	return new Promise((resolve, reject)=>{
		classdb.get(className, (err, body)=>{
			if(err){
				reject({msgid:"-",kind:"-",description:"-"});
			} else {
				resolve({msgid:body.msgid,kind:"-",description:"-"});
			}
		}).catch(()=>{});
	});
};

exports.getMessage = (result) => {
	return new Promise((resolve, reject) => {
		messagedb.get(result.msgid, (err, body)=>{
			if(err){
				result.kind="-";
				result.description="-";
				reject(result);
			} else {
				result.kind=body.kind;
				result.description=body.description;
				resolve(result);
			}
		}).catch(()=>{console.log("Message not found");});
	});
};

/** LINE BOT API Header */
exports.headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env.CHANNEL_ACCESS_TOKEN
};

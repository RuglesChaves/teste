'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'video',
	menu			: 'Cadastros',
	pageName		: 'Tutorial em Vídeo',
	pageNamePlural	: 'Tutoriais em Vídeo',
	model 			: 'video'
});

// expose this inherited controller
module.exports = Controller;

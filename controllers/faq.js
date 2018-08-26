'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'faq',
	menu			: 'Cadastros',
	pageName		: 'Pergunta Frequente',
	pageNamePlural	: 'Perguntas Frequentes',
	model 			: 'faq'
});

// expose this inherited controller
module.exports = Controller;

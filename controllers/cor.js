'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'cor',
	menu			: 'Cadastros',
	pageName		: 'Cor',
	pageNamePlural	: 'Cores',
	model 			: 'cor'
});

// override default methods


// expose this inherited controller
module.exports = Controller;

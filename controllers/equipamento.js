'use strict';

var helper = require('../config/helper');
var config = require('../config');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'equipamento',
	menu			: 'Cadastros',
	pageName		: 'Equipamento',
	pageNamePlural	: 'Equipamentos',
	model 			: 'equipamento'
});


// expose this inherited controller
module.exports = Controller;

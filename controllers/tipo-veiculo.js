'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'tipo-veiculo',
	menu			: 'Cadastros',
	pageName		: 'Tipo de Veículo',
	pageNamePlural	: 'Tipos de Veículos',
	model 			: 'tipo-veiculo'
});

// override default methods


// expose this inherited controller
module.exports = Controller;

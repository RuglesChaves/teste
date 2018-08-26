'use strict';

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'nivel-de-acesso',
	pageName		: 'Nível de acesso',
	pageNamePlural	: 'Níveis de acesso',
	model  			: 'nivel-de-acesso'
});


// expose this inherited controller
module.exports = Controller;

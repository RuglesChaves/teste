'use strict';

var helper = require('../config/helper');
var config = require('../config');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'marca',
	menu			: 'Cadastros',
	pageName		: 'Marca e Modelo',
	pageNamePlural	: 'Marcas e Modelos',
	model 			: 'marca'
});

Controller.customRoutes = function(app) {
		app.post('/'+this.route+'/find', this.find());
};

Controller.find = function() {
	var self = this;

	return function(req, res, next) {
		var Marca = require('../models/marca'),
			q = new RegExp(req.body.marca, 'i');

		Marca.findOne({nome: q}, 'modelos -_id', function(err, result) {
			if(!err && result && result.modelos) {
				var htmlModelos = '';// '<option value="">SELECIONE</option>';
				for (var i = result.modelos.length - 1; i >= 0; i--) {
					htmlModelos += '<option value=\''+result.modelos[i]+'\'>'+result.modelos[i]+'</option>';
				}

				res.json({err: 0, html: htmlModelos});
			} else {
				res.json({err: 1, message: 'Nenhum modelo encontrado.'});
			}
		});
	};
};

// expose this inherited controller
module.exports = Controller;

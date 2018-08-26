'use strict';

var helper = require('../config/helper');
var config = require('../config');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'tabela-de-preco',
	menu			: 'Cadastros',
	pageName		: 'Tabela de Preço',
	pageNamePlural	: 'Tabelas de Preço',
	model  			: 'tabela-preco'
});


Controller.create = function() {
	var Model = require('../models/tabela-preco'),
		route = this.route,
		self  = this;

	return function(req, res, next) {
		
		if(req.body.tipo === 'Permanência' && req.body.xxx === 'reiniciar tabela' && !req.body.permanencias) {
			req.flash('error','Você precisa cadastrar os preços para utilizar a opção "Utilizar novamente a tabela de preços".');
			req.body.ativo = false;
			req.body.padrao = false;
		}

		if(req.body.tipo === 'Diária' && req.body.xxx === 'reiniciar tabela' && !req.body.dias) {
			req.flash('error','Você precisa cadastrar os preços para utilizar a opção "Utilizar novamente a tabela de preços".');
			req.body.ativo = false;
			req.body.padrao = false;
		}

		if(!req.body.permanencias)
			req.body.permanencias = null;

		if(!req.body.dias)
			req.body.dias = null;


    	var	newDocument = new Model(req.body);
	    newDocument.save(function(err, result) {
			var exitCallback = function() {
				res.json({err: 0, redirect: '/'+route});
			};

			if(err) {
				res.json({err: 1, message: 'Não foi possível realizar a operação.'});
			} else {
				self.logUsuario(req, 'create', null, newDocument);
				// req.flash('success','Operação realizada com sucesso.');

				if(result.padrao === true)
					Model.update({ _id: { $ne: result.id }, tipo: result.tipo }, { $set: { padrao: false } }, { multi: true } , exitCallback);
				else 
					exitCallback();
			}

	    });
	};
};

Controller.update = function() {
	var Model = require('../models/tabela-preco'),
		route = this.route,
		self  = this;

	return function(req, res, next) {
		if(req.body.id) {

			if(req.body.tipo === 'Permanência' && req.body.xxx === 'reiniciar tabela' && !req.body.permanencias) {
				req.flash('error','Você precisa cadastrar os preços para utilizar a opção "Utilizar novamente a tabela de preços".');
				req.body.ativo = false;
				req.body.padrao = false;
			}

			if(req.body.tipo === 'Diária' && req.body.xxx === 'reiniciar tabela' && !req.body.dias) {
				req.flash('error','Você precisa cadastrar os preços para utilizar a opção "Utilizar novamente a tabela de preços".');
				req.body.ativo = false;
				req.body.padrao = false;
			}

			if(!req.body.permanencias)
				req.body.permanencias = null;

			if(!req.body.dias)
				req.body.dias = null;

			Model.findOne({_id: req.body.id}, function(err, oldDocument) {
				if(err || !oldDocument)
					res.json({err: 1, message: 'Não foi possível realizar a operação.<br />Registro não encontrado.'});
				else 
					Model.findOneAndUpdate({ _id: req.body.id }, req.body, { multi: false }, function(err, newDocument) {

						if(err)
							res.json({err: 1, message: 'Não foi possível realizar a operação.'});
						else {
							var exitCallback = function() {
								// req.flash('success','Operação realizada com sucesso.');
								self.logUsuario(req, 'update', oldDocument, newDocument);
								res.json({err: 0, redirect: '/'+route});
							};

							if(newDocument.padrao === true) {
								Model.update({ _id: { $ne: newDocument.id }, tipo: newDocument.tipo }, { $set: { padrao: false } }, { multi: true } , exitCallback);
							} else {
								exitCallback();
							}
						}

					});
			});	

		} else
			res.json({err: 1, message: 'Registro não encontrado, não foi possível realizar a operação.'});
	};
};

// expose this inherited controller
module.exports = Controller;

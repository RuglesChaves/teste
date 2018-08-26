/*'use strict';
var helper = require('../config/helper');
var mongoose = require('mongoose');
var moment = require('moment');

// require default controller
var controller = require('../controllers/controller');

//require models
var TabelaPrecos = require('../models/tabela-preco'),
	GerenciadorDeTabelas = require('../models/gerenciador-de-tabela'),
	Equipamentos	     = require('../models/equipamento'),
	Feriado = require('../models/feriado');

// creating a new controller object
var Controller = new controller({
	route			: 'niveis-de-bloqueio',
	menu			: 'Cadastros',
	pageName		: 'Nivel de Bloqueio',
	pageNamePlural	: 'Niveis de Bloqueio',
	model 			: 'niveis-de-bloqueio'
});

// uma função que receba um tipo e uma data, e a partir dai escolher a tabela correta

Controller.findTable = function (req, res) {

	Equipamentos.find({}, function(err, equipamento){

		return equipamento
	})
	
}

module.exports = Controller; */
'use strict';
var helper = require('../config/helper');
var mongoose = require('mongoose');
var moment = require('moment');

// require default controller
var controller = require('../controllers/controller');

//require models
var TabelaPrecos = require('../models/tabela-preco'),
	GerenciadorDeTabelas = require('../models/gerenciador-de-tabela'),
	Equipamento = require('../models/equipamento'),
	Feriado = require('../models/feriado');


// creating a new controller object
var Controller = new controller({
	route			: 'niveis-de-bloqueio',
	menu			: 'Cadastros',
	pageName		: 'Nivel de Bloqueio',
	pageNamePlural	: 'Niveis de Bloqueio',
	model 			: 'niveis-de-bloqueio'
});

// uma função que receba um tipo e uma data, e a partir dai escolher a tabela correta

Controller.new = function() {
	var self = this;

	return function(req, res, next) {
		req.options.isEdit = false;
		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			'route': '/'+self.route+'/cadastrar',
			'pageName': req.options.title });

		Equipamento.find({/*'tipo':'Entrada'*/}, function(err, entrada) {
			if(!err && entrada)
				req.options.entrada = entrada; 		

			Equipamento.find({/*'tipo':'Saída'*/}, function(err, saida) {
				if(!err && saida)
					req.options.saida = saida; 		

				res.render(self.route + '/show', req.options);
			});
		});

	};
};

Controller.edit = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		req.options.isEdit = true;
		req.options.action = 'Alterar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			route: '/'+self.route+'/'+req.params.id,
			pageName: req.options.title
		});
		Model.findOne({_id: req.params.id}, function(err, result) {
			if(err || !result) {
				req.flash('error','Registro não encontrado.');
				res.redirect('/'+self.route);
			} else {
	  	  		req.options.result = result;

				Equipamento.find({/*tipo:'Entrada'*/}, function(err, entrada) {
					if(!err && entrada)
						req.options.entrada = entrada; 		

					Equipamento.find({/*tipo:'Saída'*/}, function(err, saida) {
						if(!err && saida)
							req.options.saida = saida; 		

						res.render(self.route + '/show', req.options);
					});
				});


		  	}
		});
	};
};

// expose this inherited controller
module.exports = Controller;
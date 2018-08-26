'use strict';

var helper = require('../config/helper');
var config = require('../config');
var Terminal = require('../models/terminal');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'patio',
	menu			: 'Pátio',
	pageName		: 'Pátio',
	pageNamePlural	: 'Pátio',
	model 			: 'cartao'
});

Controller.customRoutes = function(app) {
	app.put('/'+this.route+'/exit/:id', this.autentication(), this.permission('exit'), this.validation('exit'), this.default(), this.exit())
	   .put('/'+this.route+'/exitAll', this.autentication(), this.permission('exit'), this.validation('exit'), this.default(), this.exitAll());
};

Controller.exitAll = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		// console.log('req.params.id: '+req.params.id);
		var terminal = req.session.terminal;
		
		if(!terminal/* || terminal.tipo.indexOf('Saída') === -1*/) {
			res.json({err: 1, message: 'Terminal não autorizado.'});
		} else {
			if(!req.body.observacao) {
			res.json({err: 1, message: 'Motivo não informado.'});
			} else {
				if(!req.body.senha || req.body.senha !== req.session.login.senha) {
					res.json({err: 1, message: 'Senha inválida'});
				} else {

					var card = {};
					card.data_fim = new Date();
					card._usuario_saida = req.session.login._id;
					card.operador_saida = req.session.login.nome;
					card._terminal_saida = terminal._id;
					card.terminal_saida = {
					    nome: terminal.nome,
				    	numero: terminal.numero
					};
					card.observacao = req.body.observacao;
					card.limpo = true;

					Model.update({data_fim: null}, card, { multi: true }, function (err) {
						if(err)
							res.json({err: 1, message: 'Ocorreu um erro ao limpar o pátio.'});
						else
							res.json({err: 0, redirect: '/'+self.route});
					});
				}
			}
		}
	};
}

Controller.exit = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {

		var terminal = req.session.terminal;
		
		if(!terminal/* || terminal.tipo.indexOf('Saída') === -1*/) {
			res.json({err: 1, message: 'Terminal não autorizado.'});
		} else {
   				if(!req.body.observacao) {
					res.json({err: 1, message: 'Motivo não informado.'});
   				} else {
   					if(!req.body.senha || req.body.senha !== req.session.login.senha) {
						res.json({err: 1, message: 'Senha inválida'});
	   				} else {

						var card = {};
						card.data_fim = new Date();
						card._usuario_saida = req.session.login._id;
						card.operador_saida = req.session.login.nome;
						card._terminal_saida = terminal._id;
						card.terminal_saida = {
						    nome: terminal.nome,
					    	numero: terminal.numero
						};
						card.observacao = req.body.observacao;
						card.limpo = true;

						console.log('.');
						console.log(card);
						console.log('req.params.id '+req.params.id);

						Model.update({'_id': req.params.id}, card, { upsert: false, new: true }, function (err) {
							if(err)
								res.json({err: 1, message: 'Ocorreu um erro ao remover o ticket do pátio.'});
							else
								res.json({err: 0, redirect: '/'+self.route});
						});

					}
				}
			}
	};
}

Controller.read = function() {
	var Model = require('../models/'+this.model),
		moment 	= require('moment'),
		self  = this;

	return function(req, res, next) {

		var page = req.query.page || 1;

		req.options.query = req.query;
		var filter = {
			data_fim: null, 
			'excluido.data_hora': null
		};
		if(req.query.codigos) 
			filter.codigos = req.query.codigos;

		Model.paginate(filter, {page: page, limit: 25, sort: {$natural: -1}}, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;

				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);

				for (var i = req.options.result.length - 1; i >= 0; i--)
					if(req.options.result[i].data_inicio) 
						req.options.result[i].permanencia = helper.diferencaData(moment(), moment(req.options.result[i].data_inicio).format('DD/MM/YYYY HH:mm'));

				res.render(req.options.route, req.options);
			}
		});
	};
};


// expose this inherited controller
module.exports = Controller;

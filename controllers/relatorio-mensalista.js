'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment = require('moment');
var async = require('async');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'relatorio-mensalista',
	menu			: 'Relatórios',
	pageName		: 'Relatório de Mensalistas',
	pageNamePlural	: 'Relatório de Mensalistas',
	model 			: 'cliente'
});

Controller.read = function() {
	var Model  = require('../models/'+this.model),
		helper = require('../config/helper'),
		self   = this;

	return function(req, res, next) {
		// Model.find().sort({$natural: -1}).exec(function(err, result) {
		var page = req.query.page || 1;
		req.options.query = req.query;

		var filter = {
			tipo: 'Mensalista'
		};

		if(req.query.dia_vencimento) {
			filter['mensalidade.dia_vencimento'] = req.query.dia_vencimento;
		}



		Model.paginate(filter, {page: page, limit: 25, sort: {'nome': 1}, populate: 'tabela._id'}, function(err, result) {
			if(!err && result) {
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);

				if(result.docs) {
					req.options.result = [];

					async.forEach(result.docs, function(cliente, callback) {
						cliente = cliente.toObject();

						helper.retornaMensalidades(cliente, function(err, cliente) {
							for (var i = cliente.mensalidade.historico.length - 1; i >= 0; i--) {
								if(cliente.mensalidade.historico[i].atrasado) {
									//console.log(cliente.mensalidade.historico[i]);
									cliente.mensalidade.situacao = 'Atrasado';
									break;
								} else {

									if(cliente.mensalidade.historico[i].isento){
										if(cliente.mensalidade.historico[i].pago){
											//console.log('Isento - Sem Bloqueio')
											cliente.mensalidade.situacao = 'Isento - Sem Bloqueio';
											
										}else{
											//console.log('Isento - Com Bloqueio')
											cliente.mensalidade.situacao = 'Isento - Com Bloqueio';
										}
									
									}else{
										if(cliente.mensalidade.historico[i].pago)
											cliente.mensalidade.situacao = 'Pago';
										else
											cliente.mensalidade.situacao = 'Em aberto';
									}

								}
							}

							if(req.query.situacao && req.query.situacao !== '') {
								if(cliente.mensalidade.situacao === req.query.situacao)
									req.options.result.push(cliente);		
							} else
								req.options.result.push(cliente);

							
							callback();
						});
					}, function(err) {
						// console.log(req.options.result);
						res.render(self.route, req.options);
					});
				} else
					res.render(self.route, req.options);
			} else
				res.render(self.route, req.options);
		});
	};
}

// expose this inherited controller
module.exports = Controller;

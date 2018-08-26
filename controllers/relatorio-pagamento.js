'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

var controller = require('../controllers/controller');

var Controller = new controller({
	route: 'relatorio-pagamento',
	menu: 'Relatórios',
	pageName: 'Relatório de Pagamento',
	pageNamePlural: 'Relatório de Pagamento',
	model: 'pagamento'
});

Controller.geraRelatorio = function (req, res, next) {
	var TabelaDePreco = require('../models/tabela-preco'),
		Usuario = require('../models/usuario'),
		Equipamento = require('../models/equipamento'),
		Pagamento = require('../models/pagamento'),
		options = req.options,
		self = this;

	req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
	req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');
	if(!req.query.horario_inicio) req.query.horario_inicio = '00:00';
	if(!req.query.horario_fim) req.query.horario_fim = '23:59';

	options.query = req.query;
 
	var filterPagamento = {
		data_pagamento: {
			'$gte': moment(req.query.data_inicio + req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString(),
			'$lte': moment(req.query.data_fim + req.query.horario_fim, 'DD/MM/YYYY HH:mm').toISOString()
		},
		$or: [],
		'excluido.data': null
	};
	console.log('req.query.usuario')
	if(req.query.usuario){
		console.log('entrou')
		console.log(req.query.usuario)
	}

	console.log('req.query.equipamento')
	if(req.query.equipamento){
		console.log('entrou')
		console.log(req.query.equipamento)
	}

	if(req.query.usuario && req.query.usuario !== 'nenhum' && req.query.equipamento && req.query.equipamento === 'nenhum'){
		filterPagamento.$or.push({_usuario:  mongoose.Types.ObjectId(req.query.usuario), _equipamento: null});
	}else{
		if (req.query.usuario){
			if(req.query.usuario !== 'nenhum')
				filterPagamento.$or.push({_usuario:  mongoose.Types.ObjectId(req.query.usuario)});
			else
				filterPagamento.$or.push({_usuario:  null});
		}else{
			filterPagamento.$or.push({_usuario:  {$ne: null}});
		}
	
		if (req.query.equipamento){
			if(req.query.equipamento !== 'nenhum')
				filterPagamento.$or.push({_equipamento:  mongoose.Types.ObjectId(req.query.equipamento)});
			else
				filterPagamento.$or.push({_equipamento: null});
		}else{
			filterPagamento.$or.push({_equipamento: {$ne: null}});
		}
	}


	if(req.query.tipo)
		filterPagamento.tipo = req.query.tipo;

	if(req.query.forma_pagamento)
		filterPagamento.forma_pagamento = req.query.forma_pagamento;
		
	Usuario.find({}, function (err, usuario) {
		if (!err && usuario){
			options.usuario = usuario;
			options.query.nome_usuario = usuario.filter( function( elem ) { return elem._id == req.query.usuario });
		}

		Equipamento.find({ tipo: 'Pagamento' }, function (err, equipamento) {
			if (!err && equipamento)
				options.equipamento = equipamento;

				if(req.query.equipamento && req.query.equipamento !== 'nenhum'){
					options.equipamentoFiltro = equipamento.filter(function(equipamento){						
						return req.query.equipamento == equipamento._id;
					});
				}
				
			options.forma_pagamento = {
				Dinheiro: {
					total: 0,
					quantidade: 0
				},
				'Cartão de Crédito': {
					total: 0,
					quantidade: 0
				},
				'Cartão de Débito': {
					total: 0,
					quantidade: 0
				}
			};

			options.tipo_cliente = {
				'Permanência': {
					total: 0,
					quantidade: 0
				},
				'Diária': {
					total: 0,
					quantidade: 0
				},
				Mensalidade: {
					total: 0,
					quantidade: 0
				},
				'Pré-Pago': {
					total: 0,
					quantidade: 0
				},
			};


			TabelaDePreco.find({ ativo: true }, null, { sort: { nome: 1 } }).exec(function (err, tabelaDePreco) {
				options.tabela_de_preco = {};
				if (!err && tabelaDePreco) {
					for (var i = 0; i < tabelaDePreco.length; i++) {
						options.tabela_de_preco[tabelaDePreco[i]._id] = {
							nome: tabelaDePreco[i].nome,
							total: 0,
							quantidade: 0
						}
					}
					console.log('Filter Pagamento')
					console.log(filterPagamento)
					Pagamento.find(filterPagamento, function (err, relatorioPagamento) {
						if (relatorioPagamento && !err) {
							
							var page = req.query.page || 1;
							Pagamento.paginate(filterPagamento, { page: page, limit: 25, sort: { $natural: -1 }, populate: '_cliente' }, function (err, result) {
								if (!err && result) {
									options.relatorioPagamento = result.docs;
									
									options.total = Number(result.total);
									options.limit = Number(result.limit);
									options.page = Number(result.page);
									options.pages = Number(result.pages);
									
									options.pagination = helper.pagination(options);
								}
								
								
								async.forEachOf(relatorioPagamento, function (pagamento, index, callback) {

									if (pagamento.valor && options.tipo_cliente && options.tipo_cliente[pagamento.tipo] && pagamento.forma_pagamento) {
										if(pagamento.forma_pagamento === 'Cartão de Debito')
											pagamento.forma_pagamento = 'Cartão de Débito';

										if(options.forma_pagamento[pagamento.forma_pagamento]) {
											options.forma_pagamento[pagamento.forma_pagamento].total += helper.moeda2float(pagamento.valor);
											options.forma_pagamento[pagamento.forma_pagamento].quantidade++;
										}
	
										options.tipo_cliente[pagamento.tipo].total += helper.moeda2float(pagamento.valor);
										options.tipo_cliente[pagamento.tipo].quantidade++;
	
										if (pagamento.tabela && pagamento.tabela._id) {
											if (options.tabela_de_preco[pagamento.tabela._id]) {
												options.tabela_de_preco[pagamento.tabela._id].total += helper.moeda2float(pagamento.valor);
												options.tabela_de_preco[pagamento.tabela._id].quantidade++;
											} else {
												options.tabela_de_preco[pagamento.tabela._id] = {
													nome: pagamento.tabela.nome,
													total: helper.moeda2float(pagamento.valor),
													quantidade: 1
												}
											}
										} 
	
									}
	
									callback();
	
								}, function (err) {
									res.render(options.route, options);
								});

							});

						}

					});

				} else
					res.render(options.route, options);

			});

		});

	});

};

Controller.print = function () {
	var self = this;

	return function (req, res, next) {
		req.options.route = self.route + '/print';
		req.options.layout = 'print'; 

		if (req.query.printComPopup)
			req.options.printComPopup = true;

		if (req.query.pdf)
			req.options.pdf = true;

		self.geraRelatorio(req, res, next);
	};
};

Controller.read = function () {
	var self = this;

	return function (req, res, next) {
		req.options.printUrl = req.url.replace(self.route, self.route + '/print/');
		self.geraRelatorio(req, res, next);
	};
};

// expose this inherited controller
module.exports = Controller;

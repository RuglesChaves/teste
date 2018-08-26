'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment = require('moment');
var Diaria = require('../models/diaria');
var async = require('async');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'relatorio-patio',
	menu			: 'Relatórios',
	pageName		: 'Relatório Movimento de Pátio',
	pageNamePlural	: 'Relatório Movimento de Pátio',
	model 			: 'cartao'
});

Controller.create = function() {
	return function(req, res, next) {
		res.redirect('/relatorio-patio');
	};
}

Controller.read = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {

		req.query.data_inicio = req.query.data_inicio || moment().format('DD/MM/YYYY');
		req.query.data_fim = req.query.data_fim || moment().format('DD/MM/YYYY');

		var timeStampDataInicio = moment(req.query.data_inicio+' 00:00','DD/MM/YYYY HH:mm').valueOf();
		var timeStampDataFim = moment(req.query.data_fim+' 23:59','DD/MM/YYYY HH:mm').valueOf();
		var timeStampDataPagamento = '';

		req.options.query = req.query;

		var filter = {
			$or:[
				{
					data_inicio: {
						'$lte': moment(req.query.data_fim+' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
					},
					data_fim: {
						'$gte': moment(req.query.data_inicio+' 00:00', 'DD/MM/YYYY HH:mm').toISOString()
					}
				},
				{
					data_inicio: {
						'$lte': moment(req.query.data_fim+' 23:59', 'DD/MM/YYYY HH:mm').toISOString()
					},
					data_fim: null
				}
			],
			'excluido.data_hora': null
		};

		// if(req.query.usuario)
			// filter._usuario = mongoose.Types.ObjectId(req.query.usuario);
		
		if(req.query.tipo)
			filter.tipo = req.query.tipo;

		if(req.query.codigos) 
			filter.codigos = req.query.codigos;

		// var page = req.query.page || 1;
		// Model.paginate(filter, {page: page, limit: 25, sort: {$natural: -1}}, function(err, result) {
		// 	if(!err && result) {
		// 		req.options.result = result.docs;

		// 		req.options.total = Number(result.total);
		// 		req.options.limit = Number(result.limit);
		// 		req.options.page = Number(result.page);
		// 		req.options.pages = Number(result.pages);

		// 		req.options.pagination = helper.pagination(req.options);
		// 	}
		// 	res.render(self.route, req.options);
		// });

		// Model.find(filter, function(err, result) {
		// 	if(!err && result) {
		// 		req.options.result = result;
		// 	}
		// 	res.render(self.route, req.options);
		// });

		var page = req.query.page || 1;

		Model.paginate(filter, {page: page, limit: 25, sort: {$natural: -1}, populate: '_diaria'}, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);
				res.render(req.options.route, req.options);
			} else 
				res.render(req.options.route, req.options);
		});











	};
};

// expose this inherited controller
module.exports = Controller;
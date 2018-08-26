'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment = require('moment');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'relatorio-ticket-excluido',
	menu			: 'Relatórios',
	pageName		: 'Relatório de Tickets Excluídos',
	pageNamePlural	: 'Relatório de Tickets Excluídos',
	model 			: 'cartao'
});

Controller.read = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
	
		var dataHoje = moment().format('DD/MM/YYYY');

		if(!req.query.data_inicio) req.query.data_inicio = dataHoje;
		if(!req.query.data_fim) req.query.data_fim = dataHoje;
		if(!req.query.horario_inicio) req.query.horario_inicio = '00:00';
		if(!req.query.horario_fim) req.query.horario_fim = '23:59';

		req.options.query = req.query;

		var filter = {
			'excluido.data_hora': { 
				'$gte': moment(req.query.data_inicio+' '+req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString(),
				'$lte': moment(req.query.data_fim+' '+req.query.horario_fim, 'DD/MM/YYYY HH:mm').toISOString()
			}
		};

		if(req.query.codigos) 
			filter.codigos = req.query.codigos;

		var page = req.query.page || 1;

		Model.paginate(filter, {page: page, limit: 25, sort: {$natural: -1}}, function(err, result) {
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
'use strict';

var moment = require('moment');
var async = require('async');
var mongoose = require('mongoose');
var helper = require('../config/helper');
var config = require('../config');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'relatorio-acesso',
	menu			: 'Relatórios',
	pageName		: 'Relatório de Acesso',
	pageNamePlural	: 'Relatório de Acesso',
	model 			: 'cartao'
});

// override default methods
Controller.read = function() {
	var Model = require('../models/'+this.model),
		self  = this,
		minutoPermanencia, dataInicio, dataFim, fatorArredondamento, minutoArredondado;

	return function(req, res, next) {

		var dataHoje = moment().format('DD/MM/YYYY');

		if(!req.query.data_inicio) req.query.data_inicio = dataHoje;
		if(!req.query.data_fim) req.query.data_fim = dataHoje;
		if(!req.query.horario_inicio) req.query.horario_inicio = '00:00';
		if(!req.query.horario_fim) req.query.horario_fim = '23:59';

		req.options.query = req.query;

		// cria o objeto com todas as faixas de horario
		req.options.relatorioAcesso = {};
		for (var i = 0; i < 24; i++) {
			req.options.relatorioAcesso[i*60] = {
				entrada: {
					Credenciado: 0, 
					'Permanência': 0, 
					Mensalista: 0, 
					'Diária': 0,
					'Pré-Pago': 0,
					total: 0
				},
				saida: {
					Credenciado: 0, 
					'Permanência': 0, 
					Mensalista: 0, 
					'Diária': 0,
					'Pré-Pago': 0,
					total: 0
				},
				total: 0,
				intervalo: helper.pad(i) + ':' + (i === 0 ? '00' : '01') + ' - ' + helper.pad(i+1) + ':00'
			}
		}

		req.options.total = {
			entrada: {
				Credenciado: 0, 
				'Permanência': 0, 
				Mensalista: 0, 
				'Diária': 0,
				'Pré-Pago': 0,
				total: 0
			},
			saida: {
				Credenciado: 0, 
				'Permanência': 0, 
				Mensalista: 0, 
				'Diária': 0,
				'Pré-Pago': 0,
				total: 0
			},
			totalGeral: 0
		};

		var fatorArredondamento = 60,
			minutoInicio,
			minutoFim,
			minutoInicioArredondado,
			minutoFimArredondado;
					
		recuperaEntrada(function() {
			recuperaSaida(function() {
				res.render(req.options.route, req.options);				    
			});
		});

		function recuperaEntrada(callback) {
			var filter = {
				data_inicio: {
					'$gte': moment(req.query.data_inicio+' '+req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString(),
					'$lte': moment(req.query.data_fim+' '+req.query.horario_fim, 'DD/MM/YYYY HH:mm').toISOString()
				},
				'excluido.data_hora': null
			};

			Model.find(filter, function(err, result) {
				if(!err && result) {
					async.forEach(Object.keys(result), function (item, callbackForEach) { 
						minutoInicio = moment.duration(moment(result[item].data_inicio).format('HH:mm')).asMinutes();

						minutoInicioArredondado = fatorArredondamento * Math.floor(minutoInicio/fatorArredondamento);

						// total por faixa de horario (soma somente este tipo de cliente para esta faixa de horario)
						req.options.relatorioAcesso[minutoInicioArredondado].entrada[result[item].tipo]++;

						// total por tipo de cliente por faixa de de horario (soma somente este tipo de cliente para uma especifica faixa de horario)
						req.options.relatorioAcesso[minutoInicioArredondado].entrada.total++;

						req.options.relatorioAcesso[minutoInicioArredondado].total++;

						// total por tipo de cliente (soma somente este tipo de cliente para todas as faixas de horario)
						req.options.total.entrada[result[item].tipo]++;

						// total de entradas (soma de todos os registros de entrada)
						req.options.total.entrada.total++;

						// total geral (soma de todos os registros)
						req.options.total.totalGeral++;

						callbackForEach();
					}, function(err) {
						callback();
					}); 
				} else 
					callback();
			});
		}

		function recuperaSaida(callback) {
			var filter = {
				data_fim: {
					'$gte': moment(req.query.data_inicio+' '+req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString(),
					'$lte': moment(req.query.data_fim+' '+req.query.horario_fim, 'DD/MM/YYYY HH:mm').toISOString()
				},
				'excluido.data_hora': null
			};

			Model.find(filter, function(err, result) {
				if(!err && result) {
					async.forEach(Object.keys(result), function (item, callbackForEach) { 
						minutoFim = moment.duration(moment(result[item].data_fim).format('HH:mm')).asMinutes();
						minutoFimArredondado = fatorArredondamento * Math.floor(minutoFim/fatorArredondamento);

						// total por faixa de horario (soma somente este tipo de cliente para esta faixa de horario)
						req.options.relatorioAcesso[minutoFimArredondado].saida[result[item].tipo]++;

						// total por tipo de cliente por faixa de de horario (soma somente este tipo de cliente para uma especifica faixa de horario)
						req.options.relatorioAcesso[minutoFimArredondado].saida.total++;

						req.options.relatorioAcesso[minutoFimArredondado].total++;

						// total por tipo de cliente (soma somente este tipo de cliente para todas as faixas de horario)
						req.options.total.saida[result[item].tipo]++;

						// total de saidas (soma de todos os registros de saida)
						req.options.total.saida.total++;

						// total geral (soma de todos os registros)
						req.options.total.totalGeral++;

						// console.log('==============');
						// console.log('id:'+ result[item]._id +' / minutoFim: ' + minutoFim + ' / minutoFimArredondado: ' + minutoFimArredondado);
						// console.log('data_fim: '+result[item].data_fim + ' / data_fim formatada: '+helper.formataData(result[item].data_fim));
						callbackForEach();
					}, function(err) {
						callback();
					}); 
				} else 
					callback();
			});
		}

	};
};
// expose this inherited controller
module.exports = Controller;

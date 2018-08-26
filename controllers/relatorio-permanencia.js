'use strict';

var moment = require('moment');
var helper = require('../config/helper');
var async = require('async');

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'relatorio-permanencia',
	menu			: 'Relatórios',
	pageName		: 'Relatório de Permanência',
	pageNamePlural	: 'Relatório de Permanência',
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

		var filter = {
			$or:[
				{
					data_inicio: {
						'$gte': moment(req.query.data_inicio+' '+req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString()
					},
					data_fim: {
						'$lte': moment(req.query.data_fim+' '+req.query.horario_fim, 'DD/MM/YYYY HH:mm').toISOString()
					}
				}
				// ,{
				// 	data_inicio: {
				// 		'$gte': moment(req.query.data_inicio+' '+req.query.horario_inicio, 'DD/MM/YYYY HH:mm').toISOString()
				// 	},
				// 	data_fim: null
				// }
			],
			'excluido.data_hora': null
		};
		

		var intervalo;

		Model.find(filter, function(err, result) {
			if(!err && result) {
				req.options.relatorioPermanencia = {};
				req.options.total = {
					Credenciado: 0, 
					'Permanência': 0, 
					Mensalista: 0, 
					'Diária': 0,
					'Pré-Pago': 0,
					totalGeral: 0
				};

				// for(var i = result.length - 1; i >= 0; i--) {

				async.forEach(Object.keys(result), function (item, callback) { 

					// if(!result[item].data_inicio && result[item].data_fim) // os credenciados que nao tem data de inicio e somente de fim
						// result[item].data_inicio = result[item].data_fim;

					if(result[item].data_inicio && result[item].tipo) {
						dataInicio = result[item].data_inicio;
						dataFim = result[item].data_fim;// ? result[item].data_fim : new Date();

						// console.log('\ndataInicio '+dataInicio);
						// console.log('dataFim '+result[item].data_fim);
						
						minutoPermanencia = parseInt(moment.duration(moment(dataFim).diff(moment(dataInicio))).asMinutes());

						if(minutoPermanencia >= 0) {

					 		fatorArredondamento = 5;	
							if(minutoPermanencia > 30)
								fatorArredondamento = 30;
							if(minutoPermanencia > 1440)
								fatorArredondamento = 60;
							if(minutoPermanencia > 6000)
								fatorArredondamento = 6000;
							
							minutoArredondado = fatorArredondamento * Math.round(minutoPermanencia/fatorArredondamento);

							if(minutoArredondado === 0 || minutoArredondado === 5) {
								minutoArredondado = 0;
								intervalo = '00:00 - 00:05';
							} else
							if(minutoArredondado === 30) {
								intervalo = '00:26 - 00:30';
							} else
								intervalo = helper.formataMinuto((minutoArredondado - fatorArredondamento )+ 1) + ' - ' + helper.formataMinuto(minutoArredondado)

							if(!req.options.relatorioPermanencia[minutoArredondado]) {
								req.options.relatorioPermanencia[minutoArredondado] = {
									Credenciado: 0, 
									'Permanência': 0, 
									Mensalista: 0, 
									'Diária': 0,
									'Pré-Pago': 0,
									intervalo: intervalo,
									total: 0
								}
							} 


							
							// total por faixa de permanencia (soma somente este tipo de cliente para esta faixa de permanencia)
							req.options.relatorioPermanencia[minutoArredondado][result[item].tipo]++;

							// total por tipo de cliente por faixa de permanencia (soma somente este tipo de cliente para uma especifica faixa de permanencia)
							req.options.relatorioPermanencia[minutoArredondado].total++;

							// total por tipo de cliente (soma somente este tipo de cliente para todas as faixas de permanencia)
							req.options.total[result[item].tipo]++;

							// total geral (soma de todos os registros)
							req.options.total.totalGeral++;

							// console.log('fatorArredondamento '+fatorArredondamento);
							// console.log('minutoPermanencia '+minutoPermanencia);
							// console.log('minutoArredondado '+minutoArredondado);

							// console.log('req.options.relatorioPermanencia[minutoArredondado]');
							// console.log(req.options.relatorioPermanencia[minutoArredondado]);
						}
					}

					callback();
					
				}, function(err) {
					res.render(req.options.route, req.options);				    
				}); 

			} else
				res.render(req.options.route, req.options);


		});
	};
};
// expose this inherited controller
module.exports = Controller;

'use strict';

// require default controller
var controller = require('../controllers/controller');
var Equipamento = require('../models/equipamento');
var helper = require('../config/helper');
var config = require('../config');

// creating a new controller object
var Controller = new controller({
	route			: 'totem',
	menu			: '',
	pageName		: '',
	pageNamePlural	: '',
	model 			: 'cartao'
});

Controller.customRoutes = function(app) {
	app.get('/'+this.route, this.read());
} 
// override default methods
Controller.read = function() {
	var self   = this;

	return function(req, res, next) {
		req.options = config.app();

		Equipamento.findOne({tipo: 'Pagamento', ip: helper.getIp(req)}, function(err, equipamento) {
			if(err || !equipamento) {
				req.options.errorMessage = 'Equipamento IP '+helper.getIp(req)+' não autorizado.';
				req.options.layout = 'basic';
				res.render('error/index', req.options);
			} else {
				req.session.equipamento = equipamento;
				req.options.layout = 'totem';
				res.render(self.route, req.options);
			}
		});
	};
}

Controller.confirmPayment = function() {
	return function(req, res, next) {
		console.log('Controller.confirmPayment = function() {');
		console.log('IP: '+helper.getIp(req));

		var equipamento = req.session.equipamento;
		
		if(!equipamento) {
			console.log('Este equipamento não possui permissão para realizar pagamentos.');
			res.json({err: 1, message: 'Este equipamento não possui permissão para realizar pagamentos.'});
		} else {
			Cartao.findOne({codigos: req.body.codigo, 'excluido.data_hora': null}, function(err, result) {
				var upsert = false;

				if(!result) {
					var pattern = helper.decodeBarcode(req.body.codigo);
					upsert = true;
					result = {
						_id: new mongoose.Types.ObjectId(),
						tipo: 'Permanência',
						nome: req.body.codigo,
						sempre_liberado: false,
						data_inicio: moment(pattern.dia+'/'+pattern.mes+'/'+pattern.ano+' '+pattern.hora+':'+pattern.minuto, 'DD/MM/YYYY HH:mm').toISOString(),
						pagamento: [],
						codigos: [req.body.codigo],
		               	ticket: {
								linha1: req.session.configuracao.ticket.linha1 || '',
								linha2: req.session.configuracao.ticket.linha2 || '',
								linha3: req.session.configuracao.ticket.linha3 || '',
								linha4: req.session.configuracao.ticket.linha4 || '',
								linha5: req.session.configuracao.ticket.linha5 || '',
								//linha6: req.session.configuracao.ticket.linha6
						}
					};
				} else
					result = result.toObject();

				result.liberado = true;
				result.limite_saida = moment(req.body.limite_saida, 'DD/MM/YYYY HH:mm').toISOString();

				console.log('++++++++++++++++++++++++++++ recebendo o payment no confirmPayment');

				var pagamento = {
					_id: new mongoose.Types.ObjectId(),
					_cliente: null,
					_cartao: result._id,
					_caixa: null,
					_usuario: null,
					_equipamento: equipamento._id,
					codigos: req.body.codigo,
					nome: 'Pagamento de Ticket',
					data_registro: new Date(),
					data_pagamento: new Date(),
					data_vencimento: new Date(),
					tipo: 'Permanência',
					pago: true,
					total: req.body.pagamento.total,
					valor: req.body.pagamento.total,
					valor_recebido: req.body.pagamento.total,
					troco: '0,00',
					forma_pagamento: req.body.forma_pagamento,
					operador: null,
					tabela: req.body.pagamento.tabela,
					data_hora: new Date(),
					tef: req.body.tef
				};
				
				if(!result.pagamento) 
					result.pagamento = [];
				result.pagamento.push(pagamento);		

				console.log('exibindo o result: (cartao)');
				console.log(result);

				var	pagamentoItem = new Pagamento(pagamento);
				pagamentoItem.save(function(err) {
					Cartao.findOneAndUpdate({_id: result._id}, result, {upsert: upsert}, function (err) {
						if(!err) {
							// gera a nota fiscal
							res.json({err: false, message: 'Pagamento realizado<br />Retire seu comprovante'});
						} else {
							console.log(err);
							res.json({err: 1, message: 'Ocorreu um erro interno, tente novamente.'});
						}
					});
				});

			});
		}
	}
}

//Controller.new, Controller.update, Controller.edit, Controller.delete, Controller.print = function(req, res, next) { return res.json({err: 1, message: 'Página não encontrada.'})};

// expose this inherited controller
module.exports = Controller;

'use strict';

var	helper			= require('../config/helper');

var Cartao 			= require('../models/cartao'),
	Caixa 			= require('../models/caixa'),
	Terminal 		= require('../models/terminal'),
	Cliente 		= require('../models/cliente'),		
	Diaria 			= require('../models/diaria'),
	Configuracao 	= require('../models/configuracao'),
	TabelaDePreco 	= require('../models/tabela-preco'),
	Equipamento 	= require('../models/equipamento'),
	type, code, sentido, Liberacao, configuracao, terminal;

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'liberacao',
	menu			: '',
	pageName		: 'Liberação',
	pageNamePlural	: '',
	model 			: 'cartao'
});

// override default methods
Controller.addRoutes = function(app) {
	app.get('/'+this.route, this.autentication(), this.default(), this.read())
	   .put('/'+this.route, this.autentication(), this.update());
}

Controller.read = function() {
	var	self   = this;

	return function(req, res, next) {
		if(req.query.iframe === '1') {
			req.options.layout = 'iframe';
			req.options.iframe = true;
		}

		req.options.sentido = req.query.sentido;

		res.render(self.route, req.options);
	};
};

Controller.update = function() {
	var self  = this;

	return function(req, res, next) {
		Liberacao = require('../config/liberacao')(req.io);

		sentido = req.query.sentido;

		console.log('a sendito: '+sentido);

		Configuracao.findOne({}, function(err, result) {
			configuracao = result;

			Terminal.findOne({ip: helper.getIp(req), tipo: sentido}, function(err, result) {
				terminal = result;

				if(err || !terminal) {
					res.json({err: err, message: 'SEU TERMINAL NÃO TEM PERMISSÃO PARA AUTORIZAR '+sentido.toUpperCase()+'.', clear: true, focus: false, 'remain-open': true});
					return;
				} 

				var decoded = helper.decodeBarcodeType(req.body.code);
				
				type = decoded.type;
				code = decoded.code;
				
				if(sentido === 'Entrada')
					self.authorizeEntry(req, res, next);
				else
					self.authorizeExit(req, res, next);
			});
		});
	};
};

function validaDiaria(filtro, callback) {
	console.log('validaDiaria');
	Diaria.findOne(filtro, function(err, diaria) { 
		if(!err && diaria) {
			Liberacao.verificaDiaria({sentido: sentido, matricula: diaria.codigos}, false, diaria, configuracao, false, terminal, function(err, message) {
				callback(err, message);
			});
		} else {
			callback(1, 'TICKET NÃO ENCONTRADO.');
		}
	});
};

function validaCliente(filtro, callback) {
	Cliente.findOne(filtro, function(err, cliente) {
		if(!err && cliente) {
			console.log('cliente.tipo '+cliente.tipo);

			if(!cliente.ativo) {
				callback(1, 'CLIENTE INATIVO.');	
			} else {
				switch(cliente.tipo) {
					case 'Pré-Pago':
						Liberacao.verificaPrePago({sentido: sentido, matricula: code}, false, cliente, configuracao, false, terminal, function(err, message) {
							console.log('1 message: '+message);
							callback(err, message);
						});
					break;
					case 'Mensalista':
						Liberacao.verificaMensalista({sentido: sentido, matricula: code}, false, cliente, configuracao, false, terminal, function(err, message) {
							console.log('2 message: '+message);
							callback(err, message);
						});
					break;
					case 'Credenciado':
						Liberacao.verificaCredenciado({sentido: sentido, matricula: code}, false, cliente, configuracao, false, terminal, function(err, message) {
							console.log('3 message: '+message);
							callback(err, message);
						});
					break;
					default: 
						callback(1, 'CLIENTE COM CADASTRO DESATUALIZADO.');
					break;
				}
			}
		} else {
			callback(1, 'CLIENTE NÃO ENCONTRADO.');
		}
	});
}

Controller.authorizeEntry = function(req, res, next) {
	// 1 se descobre o que é o codigo
	// 2 caso seja CPF ou CNPJ, placa ou proximidiade se procura um cliente
	// 2 caso seja codigo de barras braparking ou placa se procura diaria
	// 3 verifica se está apto a entrar
	// 4 incluido o veiculo no patio, exibe no monitor de atividade e aciona o relê

	console.log('authorize entry');

	if(!code || code === 'undefined') {
		console.log(1);
		res.json({err: 1, message: 'PREENCHA O CAMPO ABAIXO.', clear: false, focus: true, 'remain-open': true});
		return;
	}
	
	if(type === false) {	
		console.log(2);
		res.json({err: 1, message: 'VERIFIQUE O NÚMERO INFORMADO.', clear: false, focus: true, 'remain-open': true});
		return;
	} 

	if(!isNaN(code)) {
		code = parseInt(code, 10);
	}

	console.log(code);

	if(type === 'Código de barras') {
		console.log(4);
		Cartao.findOne({data_fim: null, 'excluido.data_hora': null, 'codigos': code}, function(err, cartao) {
			if(!err && cartao) {
				res.json({err: 1, message: 'UTILIZE A SAÍDA.', clear: true, focus: false, 'remain-open': true});
			} else {
				validaDiaria({codigos: code}, function(err, message) {
					res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
				});
			}
		});
	}

	if(type === 'CPF' || type === 'CNPJ') {
		console.log(5);
		validaCliente({cpf_cnpj: code}, function(err, message) {
			res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
		});
	}

	if(type === 'Proximidade') {
		console.log(6);
		validaCliente({codigos: code}, function(err, message) {
			res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
		});
	}

	if(type === 'Placa') {
		console.log(7);
		console.log('placa: '+code);
		Cartao.findOne({data_fim: null, 'excluido.data_hora': null, 'carro.placa': code}, function(err, cartao) {
			if(!err && cartao) {
				res.json({err: 1, message: 'UTILIZE A SAÍDA.', clear: true, focus: false, 'remain-open': true});
			} else {

				validaDiaria({'carro.placa': code}, function(err, message) {
					if(!err) {
						res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
					} else {
						validaCliente({'carro.placa': code}, function(err, message2) {
							if(!err)
								res.json({err: err, message: message2, clear: !err, focus: !err, 'remain-open': true});
							else
								res.json({err: err, message: 'DIÁRIA: '+ message + '<br /> '+ 'CLIENTE:' + message2, clear: !err, focus: !err, 'remain-open': true});
						});
					} 
				});

			}
		});
	}

}

Controller.authorizeExit = function(req, res, next) {
	// 1 se descobre oque é o codigo
	// 2 caso seja CPF ou CNPJ, placa ou proximidiade se procura um cliente
	// 3 caso seja codigo de barras braparking ou placa se procura diaria ou permanencia

	console.log('authorize exit');

	if(!code || code === 'undefined') {
		console.log(1);
		res.json({err: 1, message: 'PREENCHA O CAMPO ABAIXO.', clear: false, focus: true, 'remain-open': true});
		return;
	} 

	if(type === false) {	
		console.log(2);
		res.json({err: 1, message: 'VERIFIQUE O NÚMERO INFORMADO.', clear: false, focus: true, 'remain-open': true});
		return;
	} 

	if(!isNaN(code)) {
		code = parseInt(code, 10);
	}
			
	if(type === 'Código de barras') {
		console.log(4);
		Diaria.findOne({codigos: code}, function(err, diaria) {
			if(!err && diaria) {
				console.log('diaria');
				Liberacao.verificaDiaria({sentido: sentido, matricula: code}, false, diaria, configuracao, false, terminal, function(err, message) {
					res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
				});
			} else {
				console.log('permanencia');
				Liberacao.verificaPermanencia({sentido: sentido, matricula: code}, false, false, configuracao, false, terminal, function(err, message) {
					res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
				});		
			}
		});
	}

	if(type === 'CPF' || type === 'CNPJ') {
		console.log(5);
		validaCliente({cpf_cnpj: code}, function(err, message) {
			res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
		});
	}

	if(type === 'Proximidade') {
		console.log(6);		
		validaCliente({codigos: code}, function(err, message) {
			res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
		});
	}

	if(type === 'Placa') {
		console.log(7);
		console.log('placa: '+code);

		Cartao.findOne({data_fim: null, 'excluido.data_hora': null, $or:[ {'carro.placa': code}, {codigos: code} ] }, function(err, cartao) {

			console.log(err);
			console.log('=======cartao');
			console.log(cartao);
			if(!err && cartao) {
				console.log('+++++++++++');

				if(cartao._diaria) {
					console.log('====-----');
					validaDiaria({_id: cartao._diaria}, function(err, message) {
						res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
					});
				} 

				if(cartao._cliente) {
					validaCliente({_id: cartao._cliente}, function(err, message) {
						res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
					});
				}

				if(!cartao._diaria && !cartao._cliente) {
					Liberacao.verificaPermanencia({sentido: sentido, matricula: cartao.codigos[0]}, false, false, configuracao, false, terminal, function(err, message) {
						res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
					});	
				}

			} else {
				console.log(err);
				// mesmo que não tenha entrada verifica se é credenciado
				Cliente.findOne({$or:[ {'carro.placa': code}, {codigos: code} ]}, function(err, cliente) {
					if(!err && cliente && cliente.tipo && cliente.tipo === 'Credenciado') {
						Liberacao.verificaCredenciado({sentido: sentido, matricula: code}, false, cliente, configuracao, false, terminal, function(err, message) {
							console.log('3 message: '+message);
							res.json({err: err, message: message, clear: !err, focus: !err, 'remain-open': true});
						});
					} else {
						res.json({err: 1, message: 'A ENTRADA NÃO FOI ENCONTRADA', clear: false, focus: true, 'remain-open': true});
					}
				});
			}
		});
	}

}

// expose this inherited controller
module.exports = Controller;

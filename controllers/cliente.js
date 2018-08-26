'use strict';

var helper = require('../config/helper');
var config = require('../config');
var moment = require('moment');

var Cor				= require('../models/cor'),
	Caixa			= require('../models/caixa'),
	Marca			= require('../models/marca'),
	Cartao			= require('../models/cartao'),
	Pagamento		= require('../models/pagamento'),
	PriceTable		= require('../models/tabela-preco'),
	Bloqueio		= require('../models/niveis-de-bloqueio'),
	Equipamento    = require('../models/equipamento'),
	ManagerTable	= require('../models/gerenciador-de-tabela');

const pesoCPF = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const pesoCNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// require default controller
var controller = require('../controllers/controller');

// creating a new controller object
var Controller = new controller({
	route			: 'cliente',
	menu			: 'Cadastros',
	pageName		: 'Cliente',
	pageNamePlural	: 'Clientes',
	model 			: 'cliente'
});

Controller.read = function() {
	var Model  = require('../models/'+this.model),
		helper = require('../config/helper'),
		self   = this;

	return function(req, res, next) {
		var page = req.query.page || 1;

		var filter = {};
		if(req.query.nome && req.query.nome !== '')
			filter.nome = new RegExp(req.query.nome, 'i');
		if(req.query.categoria && req.query.categoria !== 'Todos')
			filter.categoria = req.query.categoria;
		if(req.query.ativo && req.query.ativo !== 'Todos')
			filter.ativo = req.query.ativo;
		if(req.query.tipo && req.query.tipo !== 'Todos')
			filter.tipo = req.query.tipo;
		if(req.query.cpf)
			filter.cpf_cnpj = req.query.cpf;
		if(req.query.cnpj)
			filter.cpf_cnpj = req.query.cnpj;
		if(req.query.codigos)
			filter.codigos = req.query.codigos;
		if(req.query.placa)
			filter['carro.placa'] = new RegExp(req.query.placa, 'i');
		if(req.query.com_cartao)
			filter.codigos = { $ne: [] };
		if(req.query.sem_cartao)
			filter.codigos = [];

		
		Model.paginate(filter, {page: page, limit: 60, sort: {nome: 1}, populate: 'tabela._id'}, function(err, result) {
			if(!err && result) {
				req.options.result = result.docs;
				// console.log(result.docs);
				req.options.total = Number(result.total);
				req.options.limit = Number(result.limit);
				req.options.page = Number(result.page);
				req.options.pages = Number(result.pages);

				req.options.pagination = helper.pagination(req.options);

				res.render(self.route, req.options);
			} else
				console.log(err);
		});




	};
}

Controller.find = function() {
	var Model  = require('../models/'+this.model);

	return function(req, res, next) {
		var q = new RegExp(req.body.q, 'i'),
			result = [];

		Model.find(
			{
				$or:[
					{nome: q},
					{cpf_cnpj: q},
					{'cartoes.numero': q},
					{'veiculos_placa': q},
				],
				ativo: true
			},
			'nome',
			function(err, clientes) {

				if(!err && clientes) {
					for (var i = clientes.length - 1; i >= 0; i--) {
						result[i] = {};
						result[i].value = clientes[i]._id;
						result[i].label = clientes[i].nome;
					}
				}

				res.json(result);
			}
		);

	};
};

// override default methods
Controller.new = function() {
	var self = this;

	return function(req, res, next) {
		req.options.isEdit = false;
		req.options.action = 'Cadastrar';
		req.options.title = req.options.action + ' ' + self.pageName;
		req.options.breadCrumb.push({ 
			'route': '/'+self.route+'/cadastrar',
			'pageName': req.options.title });


		ManagerTable.find({ativo: true}, function(err, managerTable){
			PriceTable.find({ativo: true, tipo: 'Permanência'}, function(err, priceTable) {
				Bloqueio.find({}, 'nome -_id', function(err, bloqueio){
				Marca.find({}, 'nome -_id', function(err, marcas) {
					Cor.find({}, 'nome -_id', function(err, cor) {
						

						
						req.options.cor = cor;
						req.options.marca = marcas;
						req.options.modelo = [];
						req.options.priceTables = priceTable;
						req.options.managerTable = managerTable;
						req.options.bloqueio= bloqueio;
						req.options.result = {
							ativo: true,
							tipo: 'Pré-Pago',
							saldo: '0,00',
							mensalidade: {
								dia_vencimento: new Date().getDate()
							}
						};

						res.render(self.route+ '/show', req.options);

					});
				});
				});
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

		
		if(req.query.iframe === '1') {
			req.options.layout = 'iframe';
			req.options.iframe = true;
		} else {
			req.options.iframe = false;
			req.options.layout = 'default';
		}



		Model.findOne({_id: req.params.id}, function(err, result) {
			if(err || !result) {
				req.flash('error','Registro não encontrado.');
				res.redirect('/'+self.route);
			} else {

				Cartao.find({_cliente: result._id, 'excluido.data_hora': null}, function(err, cartao) {

	  	  			if(cartao && !err) {

	  	  				var milliSeconds;
	  	  				for (var i = cartao.length - 1; i >= 0; i--) {
							if(cartao[i].data_inicio && !cartao[i].data_fim) {
								milliSeconds = moment(moment()).diff(moment(cartao[i].data_inicio));
								cartao[i].permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
								cartao[i].permanencia = helper.formataHora(cartao[i].permanencia);
							}
						}

	  	  				req.options.cartao = cartao;
						
	  	  			}

		  	  		var tabelaTipo = '';
		  	  		switch(result.tipo) {
		  	  			case 'Pré-Pago':
		  	  				tabelaTipo = 'Permanência';
		  	  			break;
		  	  			case 'Mensalista':
		  	  				tabelaTipo = 'Mensalidade';
		  	  			break;
		  	  		}

		  	  		if(!result.mensalidade && result.tipo !== 'Mensalidade')
	  	  				result.mensalidade = {};

		  	  		
		  	  		if(!result.mensalidade.dia_vencimento) {
		  	  			var dataAtual = new Date();
		  	  			result.mensalidade.dia_vencimento = dataAtual.getDate();
		  	  		}


					
					ManagerTable.find({ativo: true}, function(err, managerTable){

						PriceTable.find({ativo: true, tipo: tabelaTipo}, function(err, priceTable) {
						Bloqueio.find({}, 'nome -_id', function(err, bloqueio){
						Marca.find({}, 'nome modelos -_id', function(err, marcas) {
							Cor.find({}, 'nome -_id', function(err, cor) {


								req.options.cor = cor;
								req.options.marca = marcas;
								req.options.modelo = [];
								req.options.priceTables = priceTable;
								req.options.managerTable = managerTable;
								req.options.bloqueio= bloqueio;


								Pagamento.find({_cliente: result._id, tipo: 'Pré-Pago'}, function(err, pagamentos){
									if(pagamentos){
										req.options.pagamentos = pagamentos;
									}

									if(result.tipo === 'Mensalista') {

										helper.retornaMensalidades(result, 'historico financeiro', function(err, result) {
										
											if(!err && result)
												req.options.result = result;
											res.render(self.route + '/show', req.options);
										});

										// var mesInicio = moment(cliente.mensalidade.data_inicio, 'MM');
										// var mesFim = mesAtual + 6;
										// pega esses caras e da um loop pra ver se ja ta pago, se nao tiver
										// exibe nesse formato
										//<label><input type="checkbox" name="mensalidade[07][2016]" value="155,00"> 05/07/2016 R$ 155,00</label>
									} else {
										req.options.result = result;
										
										res.render(self.route + '/show', req.options);
									}
								});

							});
						});
						});
						});
					});

				});
		  	}
		});
	};



				
		  	  		

};

Controller.update = function() {
	var Model = require('../models/cliente'),
		route = this.route,
		self  = this;

	return function(req, res, next) {
		if(req.body.id) {
			console.log(req.body);

			if(!req.body.endereco)  
				req.body.endereco = null;

			if(!req.body.carro)  
				req.body.carro = null;

			if(!req.body.codigos)  
				req.body.codigos = [];

			if(req.body.tabela && req.body.tabela._id === '')
				req.body.tabela = {};
//ajuste blqueio RUGLES
			if (req.body.bloqueio && req.bloqueio._id === '') 
				req.body.bloqueio = {};

			if(req.body.gerenciador && req.body.gerenciador._id === '')
				req.body.gerenciador = {};

			if(req.session.configuracao.app.validar_cpf_cnpj){
				if(!isCPFouCNPJ(req.body.cpf_cnpj)){
					if(req.body.categoria === 'Pessoa Física')	
						return res.json({err: 1, message: 'CPF inválido.'});
					else
						return res.json({err: 1, message: 'CNPJ inválido.'});
	
				}else{
					atualizar();
				}
			}else{
				atualizar();
			}




			

	function atualizar() {
		if(!req.session.configuracao.app.validar_cpf_cnpj_duplicados){
			Model.findOne({ _id: req.body.id }, function(err, oldDocument) {
				if(oldDocument && !err) {

					var mensalidade = oldDocument.mensalidade;

					// oldDocument está se tornando um mensalista
					if(req.body.tipo === 'Mensalista' && oldDocument.tipo !== 'Mensalista') {
						mensalidade.data_inicio = new Date();
						mensalidade.data_fim = null;
					}

					// oldDocument está deixando de ser um mensalista
					if(req.body.tipo !== 'Mensalista' && oldDocument.tipo === 'Mensalista')
						mensalidade.data_fim = new Date();

					if(req.body.mensalidade.dia_vencimento)
						mensalidade.dia_vencimento = req.body.mensalidade.dia_vencimento;

					req.body.mensalidade = mensalidade;

					Model.findOneAndUpdate({_id: req.body.id}, req.body, function(err, newDocument) {
						//console.log(err);
						if(err)
							res.json({err: 1, message: 'Não foi possível realizar a operação.'});
						else {
							self.logUsuario(req, 'update', oldDocument, newDocument);
							res.json({err: 0, redirect: '/'+self.route});
						}
					});
				} else {
					res.json({err: 1, message: 'Registro não encontrado, não foi possível realizar a operação.'});
				}
			});
		}else{
			Model.findOne({cpf_cnpj: req.body.cpf_cnpj, _id: {$ne: req.body.id}}, function(err, result){
				if(err){
					res.json({err: 1, message: 'Não foi possível realizar a operação.'});
				}else if(!err && result){
					if(req.body.categoria === 'Pessoa Física')	
						return res.json({err: 1, message: 'Cliente já cadastrado com este CPF.'});
					else
						return res.json({err: 1, message: 'Cliente já cadastrado com este CNPJ.'});
				}else{
					Model.findOne({ _id: req.body.id }, function(err, oldDocument) {
						if(oldDocument && !err) {
		
							var mensalidade = oldDocument.mensalidade;
		
							// oldDocument está se tornando um mensalista
							if(req.body.tipo === 'Mensalista' && oldDocument.tipo !== 'Mensalista') {
								mensalidade.data_inicio = new Date();
								mensalidade.data_fim = null;
							}
		
							// oldDocument está deixando de ser um mensalista
							if(req.body.tipo !== 'Mensalista' && oldDocument.tipo === 'Mensalista')
								mensalidade.data_fim = new Date();
		
							if(req.body.mensalidade.dia_vencimento)
								mensalidade.dia_vencimento = req.body.mensalidade.dia_vencimento;
		
							req.body.mensalidade = mensalidade;
		
							Model.findOneAndUpdate({_id: req.body.id}, req.body, function(err, newDocument) {
								//console.log(err);
								if(err)
									res.json({err: 1, message: 'Não foi possível realizar a operação.'});
								else {
									self.logUsuario(req, 'update', oldDocument, newDocument);
									res.json({err: 0, redirect: '/'+self.route});
								}
							});
						} else {
							res.json({err: 1, message: 'Registro não encontrado, não foi possível realizar a operação.'});
						}
					});
				}
			});
		}
	}

		} else
			res.json({err: 1, message: 'Registro não encontrado, não foi possível realizar a operação.'});
	};
};

Controller.create = function() {
	var Model = require('../models/'+this.model),
		self  = this;

	return function(req, res, next) {
		if(!req.body.mensalidade)
			req.body.mensalidade = {};

		if(req.body.tipo === 'Mensalista')
			req.body.mensalidade.data_inicio = new Date();

		if(req.body.tabela && req.body.tabela._id === '')
			req.body.tabela = {};
			
		if(req.body.gerenciador && req.body.gerenciador._id === '')
			req.body.gerenciador = {};

		
		var	newDocument = new Model(req.body);

		
		
		if(req.session.configuracao.app.validar_cpf_cnpj){
			if(!isCPFouCNPJ(req.body.cpf_cnpj)){
				if(req.body.categoria === 'Pessoa Física')	
					return res.json({err: 1, message: 'CPF inválido.'});
				else
					return res.json({err: 1, message: 'CNPJ inválido.'});

			}else{
				salvar();
			}
		}else{
			salvar();
		}

		


		function salvar() {
			if(!req.session.configuracao.app.validar_cpf_cnpj_duplicados){
				newDocument.save(function(err) {
					if(err) {
						res.json({err: 1, message: 'Não foi possível realizar a operação.'});
					} else  {
						self.logUsuario(req, 'create', null, newDocument);
						res.json({err: 0, redirect: '/'+self.route});
					}
				});
			}else{
				Model.findOne({cpf_cnpj: req.body.cpf_cnpj}, function(err, result){
					if(err){
						res.json({err: 1, message: 'Não foi possível realizar a operação.'});
					}else if(!err && result){
						if(req.body.categoria === 'Pessoa Física')	
							return res.json({err: 1, message: 'Cliente já cadastrado com este CPF.'});
						else
							return res.json({err: 1, message: 'Cliente já cadastrado com este CNPJ.'});
					}else{
						newDocument.save(function(err) {
							if(err) {
								res.json({err: 1, message: 'Não foi possível realizar a operação.'});
							} else  {
								self.logUsuario(req, 'create', null, newDocument);
								res.json({err: 0, redirect: '/'+self.route});
							}
						});	
					}
				});
			}
		}

		// return res.json({err: 1, message: 'Parando operação'});

	    
	};
};



function isCPFouCNPJ(CPFouCNPJ) {
	CPFouCNPJ = CPFouCNPJ.replace(/(\.|\-|\/)/g, "");
	const black_list = ['00000000000','11111111111','22222222222','33333333333', '44444444444','55555555555', '66666666666', '77777777777', '88888888888', '99999999999','00000000000000','11111111111111','22222222222222','33333333333333', '44444444444444','55555555555555', '66666666666666', '77777777777777', '88888888888888', '99999999999999'      ]
	if ((CPFouCNPJ == null) || (CPFouCNPJ.length < 11) || (CPFouCNPJ.length > 14)) {
		return false;
	} else if (CPFouCNPJ.length === 11) {
		if(black_list.indexOf(CPFouCNPJ) >= 0)
			return false;

			var digito1 = calcularDigito(CPFouCNPJ.substring(0, 9), pesoCPF);
			var digito2 = calcularDigito(CPFouCNPJ.substring(0, 9) + digito1, pesoCPF);
			return CPFouCNPJ === CPFouCNPJ.substring(0, 9) + digito1 + digito2;
			
		} else if (CPFouCNPJ.length === 14) {
		if(black_list.indexOf(CPFouCNPJ) >= 0)
			return false;

			var digito1 = calcularDigito(CPFouCNPJ.substring(0, 12), pesoCNPJ);
			var digito2 = calcularDigito(CPFouCNPJ.substring(0, 12) + digito1, pesoCNPJ);
			return CPFouCNPJ === CPFouCNPJ.substring(0, 12) + digito1  + digito2;

	} else {
		return false;
	}
}

function calcularDigito(str, peso) {
	var soma = 0;
	for (var indice = str.length - 1, digito; indice >= 0; indice--) {
		digito = Number(str.substring(indice, indice + 1));
		soma += digito * peso[peso.length - str.length + indice];
	}
	soma = 11 - soma % 11;
	return soma > 9 ? 0 : soma;
}

// expose this inherited controller
module.exports = Controller;

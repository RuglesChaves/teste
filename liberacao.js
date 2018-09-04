'use strict';

var Card 			= require('../models/cartao'),
	Cliente 		= require('../models/cliente'),
	PriceTable 		= require('../models/tabela-preco'),
	MovimentoPatio 	= require('../models/movimento-patio'),
	Caixa 			= require('../controllers/caixa'),
	Terminal 		= require('../models/terminal'),
	Equipamento 	= require('../models/equipamento'),
	Bloqueio		= require('../models/niveis-de-bloqueio'),
	Feriado			= require('../models/feriado'),
	moment 			= require('moment'),
	helper 			= require('../config/helper'),
	async			= require('async'),
	comunicacao 	= require('../config/comunicacao'),
	mongoose 		= require('mongoose');

module.exports = function(socket) {

	var liberacao = {};

	liberacao.insereMovimentoPatio = function (data) {
		var	movimento = new MovimentoPatio(data);
		
		movimento.save(function(err) {
			if(err)
				console.log('erro ao registrar movimento');
			else {
				movimento = movimento.toObject();
				movimento.hora = helper.getHora();
				socket.emit('exibeMovimento', movimento);
			}
		});
	};

	liberacao.disparaRele = function(sentido, terminal, mensagem1, mensagem2) {
		if(sentido && terminal) {

			if(sentido === 'Entrada') {
				if(terminal.entrada && terminal.entrada._equipamento) {
					Equipamento.findOne({_id: terminal.entrada._equipamento}, function(err, equipamento) {
						if(!err && equipamento) {
							socket.emit('liberacao', {
								master: 0,
								operacao: 'Ação autorizada',
								mensagem_linha1: mensagem1,
	              				mensagem_linha2: mensagem2,
								equipamento: equipamento,
								sentido: 'Entrada'
							});
						}
					});
				}
			}

			if(sentido === 'Saída') {
				if(terminal.saida && terminal.saida._equipamento) {
					Equipamento.findOne({_id: terminal.saida._equipamento}, function(err, equipamento) {
						if(!err && equipamento) {
							socket.emit('liberacao', {
								master: 0,
								operacao: 'Ação autorizada',
								mensagem_linha1: mensagem1,
	              				mensagem_linha2: mensagem2,
								equipamento: equipamento,
								sentido: 'Saída'
							});
						}
					});
				}
			}
		}
	};

	
	liberacao.verificaVagaDisponivel = function(decodificacao, equipamento, cliente, tipo, configuracao, conexao, terminal, callback) {
		var self = this;

		if(!cliente || typeof cliente === 'undefined')
			cliente = {};

		async.series([
			// verifica a quantidade de vagas do estacionamento, caso esteja lotado nao liberada a entrada
		    function(callback) {
		    	if(configuracao.patio && configuracao.patio.quantidade_vagas && configuracao.patio.bloquear_excedente) {
			        Card.find({data_fim: null, 'excluido.data_hora': null}, function(err, result) {
			        	if(!err && result && result.length >= configuracao.patio.quantidade_vagas) {
							// console.log('patio lotado');	

							self.insereMovimentoPatio({
								_cliente: cliente._id || null,
								nome: cliente.nome || 'SEM CADASTRO',
								codigo: decodificacao.matricula,
								tipo: tipo,
								descricao: 'PÁTIO LOTADO.',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});			

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
						            master: 0,
						            operacao: 'Ação negada',
						            mensagem_linha1: configuracao.mensagem.estacionamento_lotado_linha1,
						            mensagem_linha2: configuracao.mensagem.estacionamento_lotado_linha2,
						            equipamento: equipamento
						   		}));
						   	}

					   		return(1, 'O PÁTIO ESTÁ LOTADO');
			        	} 

	        			return callback(0);
			        });
		    	} else
		    		return callback(0);
		    },
		    
		    // verifica se este cartao ja nao esta no patio
		    function(callback) { 
		    	if(tipo === 'Credenciado' && cliente && typeof cliente !== 'undefined' && typeof cliente.consistencia_entrada_saida !== 'undefined' && !cliente.consistencia_entrada_saida) {
		    		// Credenciados sem consistencia de entrada e saida podem entrar com o cartao mesmo ja tendo entrado
		    		return callback(0);
		    	} else {
			        Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null}, function(err, card) {
						if(card && !err) {
							// console.log('este cartao ja está no patio');

							self.insereMovimentoPatio({
								_cliente: cliente._id || null,
								nome: cliente.nome || 'SEM CADASTRO',
								codigo: decodificacao.matricula,
								tipo: tipo,
								descricao: 'TICKET JA ESTÁ NO PÁTIO',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});	

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
						            master: 0,
						            operacao: 'Ação negada',
						            mensagem_linha1: configuracao.mensagem.entrada_duplicada_linha1,
						            mensagem_linha2: configuracao.mensagem.entrada_duplicada_linha2,
						            equipamento: equipamento
						   		}));
						   	}

					   		return callback(1, 'UTILIZE A SAÍDA.');
						} 

						return callback(0);
					});
				}
		    },

		    // verifica se o cliente ainda tem disponivel uma vaga
		    function(callback) {
		    	if(cliente && typeof cliente !== 'undefined' && cliente.quantidade_vagas) {
					if(tipo === 'Credenciado' && typeof cliente.consistencia_entrada_saida !== 'undefined' && !cliente.consistencia_entrada_saida) {
						// Credenciados sem consistencia de entrada e saída podem entrar indefinidamente
						return callback(0);
					}

		    		if(!cliente.quantidade_vagas) 
		    			cliente.quantidade_vagas = 1;
		    	
					Card.find({_cliente: cliente._id, data_fim: null, 'excluido.data_hora': null}, function(err, result) {
			        	if(!err && result && result.length >= cliente.quantidade_vagas) {
							// console.log('sem vagas disponiveis');
							
							self.insereMovimentoPatio({
								_cliente: cliente._id,
								nome: cliente.nome,
								codigo: decodificacao.matricula,
								tipo: tipo,
								descricao: 'CLIENTE SEM VAGAS DISPONÍVEIS',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});	

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
						            master: 0,
						            operacao: 'Ação negada',
						            mensagem_linha1: configuracao.mensagem.cliente_sem_vagas_linha1,
						            mensagem_linha2: configuracao.mensagem.cliente_sem_vagas_linha2,
						            equipamento: equipamento
						   		}));
						   	}						 

					   		return callback(1, 'CLIENTE SEM VAGAS DISPONÍVEIS.');
			        	} 

			        	return callback(0);
			        });

		    	} else
		    		return callback(0);
		    }

		],
		// optional callback
		function(err, message) {
			console.log('err '+err);
			console.log('message '+message);
			if(message === 'undefined')
				message = '';

			if(callback)
				return callback(err, message);
		});
	};

	liberacao.verificaCredenciado = function(decodificacao, equipamento, cliente, configuracao, conexao, terminal, callback) {
		var upsert = false;
		var self = this;

		// console.log(equipamento);

		if(decodificacao.sentido === 'Saída') { // INICIO SAIDA //

			
		
	//INICIO DE BLOQUEIO NIVEL RUGLES 

	//se for pelo terminal não tem nivel
	if (!equipamento === true) {

		if (cliente) {
						

			Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null, tipo: 'Credenciado'}, function(err, card) {
				console.log('cartao');
				console.log(card);

				if(card) {
					
		    		card = card.toObject();
		    		var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
					card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
					card.permanencia = helper.formataHora(card.permanencia);
		    	} else { // se nao encontrar o cartao, entao ele nao entrou com o cartao, libera assim mesmo e registra somente a saida
					

					if(cliente && typeof cliente !== 'undefined' && (typeof cliente.consistencia_entrada_saida === 'undefined' || !cliente.consistencia_entrada_saida)){
						card = {
							_id: new mongoose.Types.ObjectId(),
							_cliente: cliente._id,
							nome: cliente.nome,
							codigos: [decodificacao.matricula],
							tipo: 'Credenciado',
							excluido: {
								data_hora: null
							},
							permanencia: '00:00'
						};
	
						upsert = true;

					}else{
						self.insereMovimentoPatio({
							_cliente: cliente._id || null,
							nome: cliente.nome || 'SEM NOME',
							codigo: decodificacao.matricula,
							tipo: 'Credenciado',
							descricao: 'CLIENTE JÁ SAIU DO PÁTIO',
							sentido: decodificacao.sentido,
							autorizado: false,
							_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
								nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
								nome: (terminal && terminal.nome ? terminal.nome : ''),
								numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});	

						if(conexao && conexao !== 'undefined') {
							conexao.write(comunicacao.codificaMensagem({
								master: 0,
								operacao: 'Ação negada',
								mensagem_linha1: configuracao.mensagem.entrada_duplicada_linha1,
								mensagem_linha2: configuracao.mensagem.entrada_duplicada_linha2,
								equipamento: equipamento
							   }));
						}
						if(callback && callback !== 'undefined') {
							callback(1, 'SAÍDA NÃO AUTORIZADA, CLIENTE NÃO ESTÁ NO PÁTIO.');
						}
						return;
					}

				}

				card.data_fim = new Date();
				card.liberado = false; // talvez nao precise


				if(equipamento && equipamento._id) {
					card._equipamento_saida = equipamento._id;
					card.equipamento_saida = {
					    nome: equipamento.nome,
				    	numero: equipamento.numero
					};
				}

				if(terminal && terminal._id) {
					card._terminal_saida = terminal._id;
					card.terminal_saida = {
					    nome: terminal.nome,
				    	numero: terminal.numero
					};
				}


				// verificar se precisa atualizar a permancencia

				Card.findOneAndUpdate({_id: card._id}, card, { upsert: upsert, new: true }, function (err, card) {
		            if(!err && card) {	

						self.insereMovimentoPatio({
							_cliente: cliente._id,
							nome: cliente.nome,
							codigo: decodificacao.matricula,
							tipo: cliente.tipo,
							descricao: '',
							sentido: decodificacao.sentido,
							autorizado: true,
							_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
							    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
						    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
							    nome: (terminal && terminal.nome ? terminal.nome : ''),
						    	numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});

						if(conexao && conexao !== 'undefined') {
			            	conexao.write(comunicacao.codificaMensagem({
			                    master: 0,
			                    operacao: 'Ação autorizada',
			                    mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
			                    mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
			                    equipamento: equipamento,
			                    sentido: decodificacao.sentido
			           		}));
			           	}

			           	if(callback && callback !== 'undefined') {
							callback(0, configuracao.mensagem.acesso_liberado_linha1+ ' '+configuracao.mensagem.acesso_liberado_linha2);
							self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
						}

		            } else {
						console.log('\nerr: '+err);

						if(conexao && conexao !== 'undefined') {
							conexao.write(comunicacao.codificaMensagem({
			                    master: 0,
			                    operacao: 'Ação negada',
			                    mensagem_linha1: 'ERRO INTERNO',
			                    mensagem_linha2: 'TENTE NOVAMENTE',
			                    equipamento: equipamento
			           		}));
			           	}

			           	if(callback && callback !== 'undefined') {
							callback(1, 'ERRO INTERNO 91, TENTE NOVAMENTE.');
						}

					}
		        });

			}); // fim Card.findOne
		 // FIM SAIDA

		}


		//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
				
	}else{
				
		
	Feriado.findOne({'data-feriado':moment(helper.dataHoje(),'DD/MM/YYYY 00:00:00').toDate()}, function(err, feriado){
		Bloqueio.findOne({nome: cliente.nivel}, function(err, bloqueio){
			Bloqueio.findOne({'configs.sentido': equipamento.nome}, function(err, nivel){
		
			if (!nivel) {
				//caso não tenha liberação no equipamento
								self.insereMovimentoPatio({
									_cliente: cliente._id || null,
									nome: cliente.nome || 'SEM NOME',
									codigo: decodificacao.matricula,
									tipo: cliente.tipo,
									descricao: 'BLOQUEIO NO EQUIPAMENTO',
									sentido: decodificacao.sentido,
									autorizado: false,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									  nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
									  numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									  nome: (terminal && terminal.nome ? terminal.nome : ''),
									  numero: (terminal && terminal.numero ? terminal.numero : '')
									},
									});	
								  
									if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
									  master: 0,
									  operacao: 'Ação negada',
									  mensagem_linha1: 'ACESSO NEGADO',
									  mensagem_linha2: 'NESSE EQUIPAMENTO',
									  equipamento: equipamento
									   }));
									}
									if(callback && callback !== 'undefined') {
									callback(1, 'SAÍDA NÃO AUTORIZADA, POR NIVEL DE ACESSO.');
									}
									return;
	
			}else{
				//verificar o intervalo de horas
				for (var config of nivel.configs) {
					if (config.hora_inicio <= helper.getHora() &&  config.hora_fim >= helper.getHora()) {
						while (config.sentido.indexOf(equipamento.nome) > -1) {
							//liberaração horario 
							console.log('DENTRO do horario  ' +config.sentido)
							
							if (cliente) {
						

								Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null, tipo: 'Credenciado'}, function(err, card) {
									console.log('cartao');
									console.log(card);
					
									if(card) {
										
										card = card.toObject();
										var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
										card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
										card.permanencia = helper.formataHora(card.permanencia);
									} else { // se nao encontrar o cartao, entao ele nao entrou com o cartao, libera assim mesmo e registra somente a saida
										
					
										if(cliente && typeof cliente !== 'undefined' && (typeof cliente.consistencia_entrada_saida === 'undefined' || !cliente.consistencia_entrada_saida)){
											card = {
												_id: new mongoose.Types.ObjectId(),
												_cliente: cliente._id,
												nome: cliente.nome,
												codigos: [decodificacao.matricula],
												tipo: 'Credenciado',
												excluido: {
													data_hora: null
												},
												permanencia: '00:00'
											};
						
											upsert = true;
					
										}else{
											self.insereMovimentoPatio({
												_cliente: cliente._id || null,
												nome: cliente.nome || 'SEM NOME',
												codigo: decodificacao.matricula,
												tipo: 'Credenciado',
												descricao: 'CLIENTE JÁ SAIU DO PÁTIO',
												sentido: decodificacao.sentido,
												autorizado: false,
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: {
													nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
													numero: (equipamento && equipamento.numero ? equipamento.numero : '')
												},
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: {
													nome: (terminal && terminal.nome ? terminal.nome : ''),
													numero: (terminal && terminal.numero ? terminal.numero : '')
												},
											});	
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação negada',
													mensagem_linha1: configuracao.mensagem.entrada_duplicada_linha1,
													mensagem_linha2: configuracao.mensagem.entrada_duplicada_linha2,
													equipamento: equipamento
												   }));
											}
											if(callback && callback !== 'undefined') {
												callback(1, 'SAÍDA NÃO AUTORIZADA, CLIENTE NÃO ESTÁ NO PÁTIO.');
											}
											return;
										}
					
									}
					
									card.data_fim = new Date();
									card.liberado = false; // talvez nao precise
					
					
									if(equipamento && equipamento._id) {
										card._equipamento_saida = equipamento._id;
										card.equipamento_saida = {
											nome: equipamento.nome,
											numero: equipamento.numero
										};
									}
					
									if(terminal && terminal._id) {
										card._terminal_saida = terminal._id;
										card.terminal_saida = {
											nome: terminal.nome,
											numero: terminal.numero
										};
									}
					
					
									// verificar se precisa atualizar a permancencia
					
									Card.findOneAndUpdate({_id: card._id}, card, { upsert: upsert, new: true }, function (err, card) {
										if(!err && card) {	
					
											self.insereMovimentoPatio({
												_cliente: cliente._id,
												nome: cliente.nome,
												codigo: decodificacao.matricula,
												tipo: cliente.tipo,
												descricao: '',
												sentido: decodificacao.sentido,
												autorizado: true,
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: {
													nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
													numero: (equipamento && equipamento.numero ? equipamento.numero : '')
												},
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: {
													nome: (terminal && terminal.nome ? terminal.nome : ''),
													numero: (terminal && terminal.numero ? terminal.numero : '')
												},
											});
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação autorizada',
													mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
													mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
													equipamento: equipamento,
													sentido: decodificacao.sentido
												   }));
											   }
					
											   if(callback && callback !== 'undefined') {
												callback(0, configuracao.mensagem.acesso_liberado_linha1+ ' '+configuracao.mensagem.acesso_liberado_linha2);
												self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
											}
					
										} else {
											console.log('\nerr: '+err);
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação negada',
													mensagem_linha1: 'ERRO INTERNO',
													mensagem_linha2: 'TENTE NOVAMENTE',
													equipamento: equipamento
												   }));
											   }
					
											   if(callback && callback !== 'undefined') {
												callback(1, 'ERRO INTERNO 91, TENTE NOVAMENTE.');
											}
					
										}
									});
					
								}); // fim Card.findOne
							 // FIM SAIDA
								
							}
							break
						}
					}else{
						while (config.sentido.indexOf(equipamento.nome) > -1) {
							//BLOQUEIO  FORA DO HORARIO
							console.log('fora do horario  '+config.sentido)

							while (!config.sentido.indexOf(equipamento.nome) > -1) {
								self.insereMovimentoPatio({
									_cliente: cliente._id || null,
									nome: cliente.nome || 'SEM NOME',
									codigo: decodificacao.matricula,
									tipo: cliente.tipo,
									descricao: 'BLOQUEIO NO FORA DO HORARIO',
									sentido: decodificacao.sentido,
									autorizado: false,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									  nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
									  numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									  nome: (terminal && terminal.nome ? terminal.nome : ''),
									  numero: (terminal && terminal.numero ? terminal.numero : '')
									},
									});	
								  
									if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
									  master: 0,
									  operacao: 'Ação negada',
									  mensagem_linha1: 'ACESSO NEGADO',
									  mensagem_linha2: 'FORA DO HORARIO',
									  equipamento: equipamento
									   }));
									}
									if(callback && callback !== 'undefined') {
									callback(1, 'SAÍDA NÃO AUTORIZADA, FORA DO HORARIO.');
									}
										return;
										break;
								}

							
						}
					}
			//verificar se o dia e feriado, e se aopção esta marcado
			if (config.dias.indexOf('Feriado') > -1)  {

				while (config.sentido.indexOf(equipamento.nome) > -1) {
					//liberada o feriado	
					console.log('LIBERADO NO FERIADO   ' +config.sentido)
						
					if (cliente) {
						

						Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null, tipo: 'Credenciado'}, function(err, card) {
							console.log('cartao');
							console.log(card);
			
							if(card) {
								
								card = card.toObject();
								var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
								card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
								card.permanencia = helper.formataHora(card.permanencia);
							} else { // se nao encontrar o cartao, entao ele nao entrou com o cartao, libera assim mesmo e registra somente a saida
								
			
								if(cliente && typeof cliente !== 'undefined' && (typeof cliente.consistencia_entrada_saida === 'undefined' || !cliente.consistencia_entrada_saida)){
									card = {
										_id: new mongoose.Types.ObjectId(),
										_cliente: cliente._id,
										nome: cliente.nome,
										codigos: [decodificacao.matricula],
										tipo: 'Credenciado',
										excluido: {
											data_hora: null
										},
										permanencia: '00:00'
									};
				
									upsert = true;
			
								}else{
									self.insereMovimentoPatio({
										_cliente: cliente._id || null,
										nome: cliente.nome || 'SEM NOME',
										codigo: decodificacao.matricula,
										tipo: 'Credenciado',
										descricao: 'CLIENTE JÁ SAIU DO PÁTIO',
										sentido: decodificacao.sentido,
										autorizado: false,
										_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
										equipamento: {
											nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
											numero: (equipamento && equipamento.numero ? equipamento.numero : '')
										},
										_terminal: (terminal && terminal._id ? terminal._id : null),
										terminal: {
											nome: (terminal && terminal.nome ? terminal.nome : ''),
											numero: (terminal && terminal.numero ? terminal.numero : '')
										},
									});	
			
									if(conexao && conexao !== 'undefined') {
										conexao.write(comunicacao.codificaMensagem({
											master: 0,
											operacao: 'Ação negada',
											mensagem_linha1: configuracao.mensagem.entrada_duplicada_linha1,
											mensagem_linha2: configuracao.mensagem.entrada_duplicada_linha2,
											equipamento: equipamento
										   }));
									}
									if(callback && callback !== 'undefined') {
										callback(1, 'SAÍDA NÃO AUTORIZADA, CLIENTE NÃO ESTÁ NO PÁTIO.');
									}
									return;
								}
			
							}
			
							card.data_fim = new Date();
							card.liberado = false; // talvez nao precise
			
			
							if(equipamento && equipamento._id) {
								card._equipamento_saida = equipamento._id;
								card.equipamento_saida = {
									nome: equipamento.nome,
									numero: equipamento.numero
								};
							}
			
							if(terminal && terminal._id) {
								card._terminal_saida = terminal._id;
								card.terminal_saida = {
									nome: terminal.nome,
									numero: terminal.numero
								};
							}
			
			
							// verificar se precisa atualizar a permancencia
			
							Card.findOneAndUpdate({_id: card._id}, card, { upsert: upsert, new: true }, function (err, card) {
								if(!err && card) {	
			
									self.insereMovimentoPatio({
										_cliente: cliente._id,
										nome: cliente.nome,
										codigo: decodificacao.matricula,
										tipo: cliente.tipo,
										descricao: '',
										sentido: decodificacao.sentido,
										autorizado: true,
										_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
										equipamento: {
											nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
											numero: (equipamento && equipamento.numero ? equipamento.numero : '')
										},
										_terminal: (terminal && terminal._id ? terminal._id : null),
										terminal: {
											nome: (terminal && terminal.nome ? terminal.nome : ''),
											numero: (terminal && terminal.numero ? terminal.numero : '')
										},
									});
			
									if(conexao && conexao !== 'undefined') {
										conexao.write(comunicacao.codificaMensagem({
											master: 0,
											operacao: 'Ação autorizada',
											mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
											mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
											equipamento: equipamento,
											sentido: decodificacao.sentido
										   }));
									   }
			
									   if(callback && callback !== 'undefined') {
										callback(0, configuracao.mensagem.acesso_liberado_linha1+ ' '+configuracao.mensagem.acesso_liberado_linha2);
										self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
									}
			
								} else {
									console.log('\nerr: '+err);
			
									if(conexao && conexao !== 'undefined') {
										conexao.write(comunicacao.codificaMensagem({
											master: 0,
											operacao: 'Ação negada',
											mensagem_linha1: 'ERRO INTERNO',
											mensagem_linha2: 'TENTE NOVAMENTE',
											equipamento: equipamento
										   }));
									   }
			
									   if(callback && callback !== 'undefined') {
										callback(1, 'ERRO INTERNO 91, TENTE NOVAMENTE.');
									}
			
								}
							});
			
						}); // fim Card.findOne
					 // FIM SAIDA
			
					}				
						break;
					}
					if (config.dias.indexOf(helper.diaSemana()) > -1)  {
						while (config.sentido.indexOf(equipamento.nome) > -1) {
							console.log('LIBERADO NA SEMANA   ' +config.sentido)
							
							if (cliente) {
						

								Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null, tipo: 'Credenciado'}, function(err, card) {
									console.log('cartao');
									console.log(card);
					
									if(card) {
										
										card = card.toObject();
										var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
										card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
										card.permanencia = helper.formataHora(card.permanencia);
									} else { // se nao encontrar o cartao, entao ele nao entrou com o cartao, libera assim mesmo e registra somente a saida
										
					
										if(cliente && typeof cliente !== 'undefined' && (typeof cliente.consistencia_entrada_saida === 'undefined' || !cliente.consistencia_entrada_saida)){
											card = {
												_id: new mongoose.Types.ObjectId(),
												_cliente: cliente._id,
												nome: cliente.nome,
												codigos: [decodificacao.matricula],
												tipo: 'Credenciado',
												excluido: {
													data_hora: null
												},
												permanencia: '00:00'
											};
						
											upsert = true;
					
										}else{
											self.insereMovimentoPatio({
												_cliente: cliente._id || null,
												nome: cliente.nome || 'SEM NOME',
												codigo: decodificacao.matricula,
												tipo: 'Credenciado',
												descricao: 'CLIENTE JÁ SAIU DO PÁTIO',
												sentido: decodificacao.sentido,
												autorizado: false,
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: {
													nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
													numero: (equipamento && equipamento.numero ? equipamento.numero : '')
												},
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: {
													nome: (terminal && terminal.nome ? terminal.nome : ''),
													numero: (terminal && terminal.numero ? terminal.numero : '')
												},
											});	
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação negada',
													mensagem_linha1: configuracao.mensagem.entrada_duplicada_linha1,
													mensagem_linha2: configuracao.mensagem.entrada_duplicada_linha2,
													equipamento: equipamento
												   }));
											}
											if(callback && callback !== 'undefined') {
												callback(1, 'SAÍDA NÃO AUTORIZADA, CLIENTE NÃO ESTÁ NO PÁTIO.');
											}
											return;
										}
					
									}
					
									card.data_fim = new Date();
									card.liberado = false; // talvez nao precise
					
					
									if(equipamento && equipamento._id) {
										card._equipamento_saida = equipamento._id;
										card.equipamento_saida = {
											nome: equipamento.nome,
											numero: equipamento.numero
										};
									}
					
									if(terminal && terminal._id) {
										card._terminal_saida = terminal._id;
										card.terminal_saida = {
											nome: terminal.nome,
											numero: terminal.numero
										};
									}
					
					
									// verificar se precisa atualizar a permancencia
					
									Card.findOneAndUpdate({_id: card._id}, card, { upsert: upsert, new: true }, function (err, card) {
										if(!err && card) {	
					
											self.insereMovimentoPatio({
												_cliente: cliente._id,
												nome: cliente.nome,
												codigo: decodificacao.matricula,
												tipo: cliente.tipo,
												descricao: '',
												sentido: decodificacao.sentido,
												autorizado: true,
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: {
													nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
													numero: (equipamento && equipamento.numero ? equipamento.numero : '')
												},
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: {
													nome: (terminal && terminal.nome ? terminal.nome : ''),
													numero: (terminal && terminal.numero ? terminal.numero : '')
												},
											});
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação autorizada',
													mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
													mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
													equipamento: equipamento,
													sentido: decodificacao.sentido
												   }));
											   }
					
											   if(callback && callback !== 'undefined') {
												callback(0, configuracao.mensagem.acesso_liberado_linha1+ ' '+configuracao.mensagem.acesso_liberado_linha2);
												self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
											}
					
										} else {
											console.log('\nerr: '+err);
					
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação negada',
													mensagem_linha1: 'ERRO INTERNO',
													mensagem_linha2: 'TENTE NOVAMENTE',
													equipamento: equipamento
												   }));
											   }
					
											   if(callback && callback !== 'undefined') {
												callback(1, 'ERRO INTERNO 91, TENTE NOVAMENTE.');
											}
					
										}
									});
					
								}); // fim Card.findOne
							 // FIM SAIDA
					
							}
					
					
							//+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
							break;
					}
			}else{
					while (config.sentido.indexOf(equipamento.nome) > -1) {
						//bloqueio na semana
						console.log('BLOQUEADO NA SEMANA   ' +config.sentido)

						while (!config.sentido.indexOf(equipamento.nome) > -1) {
							self.insereMovimentoPatio({
								_cliente: cliente._id || null,
								nome: cliente.nome || 'SEM NOME',
								codigo: decodificacao.matricula,
								tipo: cliente.tipo,
								descricao: 'BLOQUEIO NO FERIADO',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								  nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								  numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								  nome: (terminal && terminal.nome ? terminal.nome : ''),
								  numero: (terminal && terminal.numero ? terminal.numero : '')
								},
								});	
							  
								if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
								  master: 0,
								  operacao: 'Ação negada',
								  mensagem_linha1: 'ACESSO NEGADO',
								  mensagem_linha2: 'NESSE DIA',
								  equipamento: equipamento
								   }));
								}
								if(callback && callback !== 'undefined') {
								callback(1, 'SAÍDA NÃO AUTORIZADA, NESSE DIA .');
								}
									return;
									break;
							}
						
						
						break;
				}
			}						

		}else{
				if (!config.dias.indexOf('Feriado') > -1)  {

				while (config.sentido.indexOf(equipamento.nome) > -1) {

																	
					//console.log('BLOQUEIO NO FERIADO')
 					//quando o dia da semanah não estiver liberado
						for (var config of nivel.configs) {
							while (!config.sentido.indexOf(equipamento.nome) > -1) {
								self.insereMovimentoPatio({
									_cliente: cliente._id || null,
									nome: cliente.nome || 'SEM NOME',
									codigo: decodificacao.matricula,
									tipo: cliente.tipo,
									descricao: 'BLOQUEIO NO FERIADO',
									sentido: decodificacao.sentido,
									autorizado: false,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									  nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
									  numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									  nome: (terminal && terminal.nome ? terminal.nome : ''),
									  numero: (terminal && terminal.numero ? terminal.numero : '')
									},
									});	
								  
									if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
									  master: 0,
									  operacao: 'Ação negada',
									  mensagem_linha1: 'ACESSO NEGADO',
									  mensagem_linha2: 'FERIADO',
									  equipamento: equipamento
									   }));
									}
									if(callback && callback !== 'undefined') {
									callback(1, 'SAÍDA NÃO AUTORIZADA, FERIADO .');
									}
										return;
										break;
								}
							}
							}
						}
					}
				}
			}
		})
	})	
})



} //FIM DO ELSE TERMINAL
			
} 


		if(decodificacao.sentido === 'Entrada') {
				// console.log('Entrada de credenciado');

				if (cliente.nivel === 'entrada'|| cliente.nivel === '' || cliente.nivel === 'ambos') {
					console.log('Entrada liberada pelo nivel cliente   ' +cliente.nivel)

				this.verificaVagaDisponivel(decodificacao, equipamento, cliente, 'Credenciado', configuracao, conexao, terminal, function(err, message) {

					if(err && callback && callback !== 'undefined' && message) {
						callback(1, message);
					}

					if(!err) {

						// console.log('registrando no banco de dados');
						
						var cartao = new Card({
							_id: new mongoose.Types.ObjectId,
							_cliente: cliente._id,
							nome: cliente.nome,
							data_fim: null,
							sempre_liberado: true,
							liberado: true,
							tipo: 'Credenciado',
							data_inicio: new Date(),
							data_cadastro: new Date(),
							codigos: [decodificacao.matricula],
							excluido: {
					        	data_hora: null
					        },
					        _equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
							    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
						    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
							    nome: (terminal && terminal.nome ? terminal.nome : ''),
						    	numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});

						cartao.save(function(err) {
							if(!err) {
								self.insereMovimentoPatio({
									_cliente: cliente._id,
									nome: cliente.nome,
									codigo: decodificacao.matricula,
									tipo: cliente.tipo,
									descricao: '',
									sentido: decodificacao.sentido,
									autorizado: true,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									    nome: (terminal && terminal.nome ? terminal.nome : ''),
								    	numero: (terminal && terminal.numero ? terminal.numero : '')
									},
								});

								if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
						                master: 0,
						                operacao: 'Ação autorizada',
						                mensagem_linha1: configuracao.mensagem.entrada_liberado_linha1,
						                mensagem_linha2: configuracao.mensagem.entrada_liberado_linha2,
						                equipamento: equipamento,
						                sentido: decodificacao.sentido
						       		}));
						       	}

						       	if(callback && callback !== 'undefined') {
									callback(0, configuracao.mensagem.entrada_liberado_linha1+ ' '+configuracao.mensagem.entrada_liberado_linha2);
									self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.entrada_liberado_linha1, configuracao.mensagem.entrada_liberado_linha2);
								}

							} else {
								// console.log('\nerr: '+err);
								if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
						                master: 0,
						                operacao: 'Ação negada',
						                mensagem_linha1: 'ERRO INTERNO',
						                mensagem_linha2: 'TENTE NOVAMENTE',
						                equipamento: equipamento
						       		}));
						       	}

						       	if(callback && callback !== 'undefined') {
									callback(1, 'ERRO INTERNO 92, TENTE NOVAMENTE.');
								}
							}
						
						});

					}
				});


		} else{

			self.insereMovimentoPatio({
				_cliente: cliente._id || null,
				nome: cliente.nome || 'SEM NOME',
				codigo: decodificacao.matricula,
				tipo: 'Credenciado',
				descricao: 'CLIENTE JÁ SAIU DO PÁTIO',
				sentido: decodificacao.sentido,
				autorizado: false,
				_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
				equipamento: {
					nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
					numero: (equipamento && equipamento.numero ? equipamento.numero : '')
				},
				_terminal: (terminal && terminal._id ? terminal._id : null),
				terminal: {
					nome: (terminal && terminal.nome ? terminal.nome : ''),
					numero: (terminal && terminal.numero ? terminal.numero : '')
				},
			});	

			if(conexao && conexao !== 'undefined') {
				conexao.write(comunicacao.codificaMensagem({
					master: 0,
					operacao: 'Ação negada',
					mensagem_linha1: 'ACESSO NEGADO',
					mensagem_linha2: 'ENTRADA POR NIVEL',
					equipamento: equipamento
				   }));
			}
			if(callback && callback !== 'undefined') {
				callback(1, 'SAÍDA NÃO AUTORIZADA, POR NIVEL DE ACESSO.');
			}
			return;


		}// FIM ENTRADA
		

	} //IF LIBERAÇÂO ENTRADA RUGLES
	
	}; 

	

	liberacao.verificaMensalista = function(decodificacao, equipamento, cliente, configuracao, conexao, terminal, callback) {
		var self = this;

		function retornaLiberacao(liberado) {
			// console.log('cliente');
			// console.log(cliente);

			console.log('=======================================================')	
			console.log('retornaLiberacao: '+liberado);

			if(!liberado) {
				
				self.insereMovimentoPatio({
					_cliente: cliente._id,
					nome: cliente.nome,
					codigo: decodificacao.matricula,
					tipo: 'Mensalista',
					descricao: configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha1+' '+configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha2,
					sentido: decodificacao.sentido,
					autorizado: false,
					_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
					equipamento: {
					    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
				    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
					},
					_terminal: (terminal && terminal._id ? terminal._id : null),
					terminal: {
					    nome: (terminal && terminal.nome ? terminal.nome : ''),
				    	numero: (terminal && terminal.numero ? terminal.numero : '')
					},
				});	

				if(conexao && conexao !== 'undefined') {
					conexao.write(comunicacao.codificaMensagem({
			            master: 0,
			            operacao: 'Ação negada',
			            mensagem_linha1: configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha1,
			            mensagem_linha2: configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha2,
			            equipamento: equipamento
			   		}));
				}

				if(callback && callback !== 'undefined') {
					callback(1, configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha1 + ' ' +configuracao.mensagem.entrada_bloqueada_inadimplencia_mensalista_linha2);
				}

			} else {
				// cria a entrada do mensalista
				var cartao = new Card({
					_id: new mongoose.Types.ObjectId,
					_cliente: cliente._id,
					nome: cliente.nome,
					data_fim: null,
					sempre_liberado: false,
					liberado: true,
					tipo: 'Mensalista',
					data_inicio: new Date(),
					data_cadastro: new Date(),
					codigos: [decodificacao.matricula],
					excluido: {
			        	data_hora: null
			        },
			        _equipamento: (equipamento && equipamento._id ? equipamento._id : null),
					equipamento: {
					    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
				    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
					},
					_terminal: (terminal && terminal._id ? terminal._id : null),
					terminal: {
					    nome: (terminal && terminal.nome ? terminal.nome : ''),
				    	numero: (terminal && terminal.numero ? terminal.numero : '')
					},
				});

				cartao.save(function(err) {
					if(!err) {
						self.insereMovimentoPatio({
							_cliente: cliente._id,
							nome: cliente.nome,
							codigo: decodificacao.matricula,
							tipo: cliente.tipo,
							descricao: '',
							sentido: decodificacao.sentido,
							autorizado: true,
							_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
							    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
						    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
							    nome: (terminal && terminal.nome ? terminal.nome : ''),
						    	numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});

						if(conexao && conexao !== 'undefined') {	
							conexao.write(comunicacao.codificaMensagem({
				                master: 0,
				                operacao: 'Ação autorizada',
				                mensagem_linha1: configuracao.mensagem.entrada_liberado_linha1,
				                mensagem_linha2: configuracao.mensagem.entrada_liberado_linha2,
				                equipamento: equipamento,
				                sentido: decodificacao.sentido
			       			}));
			       		}

			       		if(callback && callback !== 'undefined') {
							callback(0, configuracao.mensagem.entrada_liberado_linha1 + ' ' +configuracao.mensagem.entrada_liberado_linha2);
							self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.entrada_liberado_linha1, configuracao.mensagem.entrada_liberado_linha2);
						}

					} else {
						// console.log('\nerr: '+err);
						if(conexao && conexao !== 'undefined') {	
							conexao.write(comunicacao.codificaMensagem({
				                master: 0,
				                operacao: 'Ação negada',
				                mensagem_linha1: 'ERRO INTERNO 74',
				                mensagem_linha2: 'TENTE NOVAMENTE',
				                equipamento: equipamento
				       		}));
				       	}

				       	if(callback && callback !== 'undefined') {
							callback(1, 'ERRO INTERNO 74, TENTE NOVAMENTE.');
						}

					}

				});
			}
		}


		if(decodificacao.sentido === 'Entrada') {
			// console.log('ENTRADA MENSALISTA');
			
			this.verificaVagaDisponivel(decodificacao, equipamento, cliente, 'Mensalista', configuracao, conexao, terminal, function(err, message) {
				

				if(err && callback && callback !== 'undefined' && message) {
					callback(1, message);
				}

				if(!err) {

					var idTabela;
					if(cliente.tabela && cliente.tabela._id && cliente.tabela._id !== '')
						idTabela = cliente.tabela._id;

					helper.findPriceTable('Mensalidade', idTabela, function(err, priceTable) {
						if(err || !priceTable) {

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
					                master: 0,
					                operacao: 'Ação negada',
					                mensagem_linha1: 'TABELA MENSALISTA',
					                mensagem_linha2: 'NAO ENCONTRADA',
					                equipamento: equipamento
					       		}));
					       	}

					       	if(callback && callback !== 'undefined') {
								callback(1, 'TABELA DE MENSALISTA NÃO ENCONTRADA.');
							}

	       					self.insereMovimentoPatio({
								_cliente: cliente._id,
								nome: cliente.nome,
								codigo: decodificacao.matricula,
								tipo: 'Mensalista',
								descricao: 'TABELA DE MENSALISTA NAO ENCONTRADA',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});	

						} else {

							var liberado = false;

							if(priceTable.mensalidade.bloquear_inadimplente) {
								helper.retornaMensalidades(cliente, 'historico financeiro', function(err, cliente) {
									if(!err && cliente) {

										liberado = true;
										if(cliente.mensalidade.historico) {
											console.log("Meses montados");
											console.log(cliente.mensalidade.historico);
											for (var i = 0; i < cliente.mensalidade.historico.length; i++) {
												var historico = cliente.mensalidade.historico[i];
												console.log('MES: '+historico.mes+' ANO '+historico.ano);
												if(historico.atrasado) {
													console.log('ENTROU ATRASADO!!!!!!')
													console.log('Tolerancia')
													console.log(priceTable.mensalidade.tolerancia)
													liberado = false;

													if(priceTable.mensalidade.tolerancia && priceTable.mensalidade.tolerancia > 0) {
														var dataVencimento = historico.ano + '-' + historico.mes + '-' + historico.dia_vencimento + ' 23:59';
														console.log('DATA DE VENCIMENTO')
														console.log(dataVencimento)
														var timeStampVencimento = moment(dataVencimento, 'YYYY-MM-DD HH:mm').add({days: priceTable.mensalidade.tolerancia}).valueOf();
														var timeStampAtual = moment().valueOf();

														if(timeStampAtual < timeStampVencimento) {
															console.log('ESTÁ NO LIMITE DE TOLERÂNCIA DE ATRASO')
															// console.log('tolerancia de '+priceTable.mensalidade.tolerancia+' dias');
															liberado = true;
														}
													}
													break;
												}
											}
										}

										return retornaLiberacao(liberado);
									}
								});
							} else {
								liberado = true;
								retornaLiberacao(liberado);
							}


						}
					});

				}
			});
		}
		
		if(decodificacao.sentido === 'Saída') {
			// console.log('\nSAIDA MENSALISTA');

			Card.findOne({ codigos: decodificacao.matricula, tipo: 'Mensalista',  data_fim: null, 'excluido.data_hora': null}, function(err, card) {
				if(!card) {
					// precisa ter entrado para poder sair, ou seja, nao tem entrada offline para pre-pagos
					self.insereMovimentoPatio({
						_cliente: cliente._id,
						nome: cliente.nome,
						codigo: decodificacao.matricula,
						tipo: 'Mensalista',
						descricao: 'A ENTRADA DO CLIENTE NAO FOI ENCONTRADA',
						sentido: decodificacao.sentido,
						autorizado: false,
						_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
						equipamento: {
						    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
					    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
						},
						_terminal: (terminal && terminal._id ? terminal._id : null),
						terminal: {
						    nome: (terminal && terminal.nome ? terminal.nome : ''),
					    	numero: (terminal && terminal.numero ? terminal.numero : '')
						},
					});	

					if(conexao && conexao !== 'undefined') {
						conexao.write(comunicacao.codificaMensagem({
			                master: 0,
			                operacao: 'Ação negada',
			                mensagem_linha1: 'DESCULPE SUA ENTRADA',
			                mensagem_linha2: 'NAO FOI ENCONTRADA',
			                equipamento: equipamento
			       		}));
			       	}

			       	if(callback && callback !== 'undefined') {
						callback(1, 'A ENTRADA NAO FOI ENCONTRADA.');
					}					

				} else {
					var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
					card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
					card.permanencia = helper.formataHora(card.permanencia);

					card.data_fim = new Date();

					if(equipamento && equipamento._id) {
						card._equipamento_saida = equipamento._id;
						card.equipamento_saida = {
						    nome: equipamento.nome,
					    	numero: equipamento.numero
						}
					}

					if(terminal && terminal._id) {
						card._terminal_saida = terminal._id;
						card.terminal_saida = {
						    nome: terminal.nome,
					    	numero: terminal.numero
						}
					}


					Card.findOneAndUpdate({_id: card._id}, card, { upsert: false, new: true }, function (err, card) {
						if(!err && card) {
		                    if(!err && card) {

		                    	self.insereMovimentoPatio({
									_cliente: cliente._id,
									nome: cliente.nome,
									codigo: decodificacao.matricula,
									tipo: cliente.tipo,
									descricao: '',
									sentido: decodificacao.sentido,
									autorizado: true,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									    nome: (terminal && terminal.nome ? terminal.nome : ''),
								    	numero: (terminal && terminal.numero ? terminal.numero : '')
									},
								});

		                    	if(conexao && conexao !== 'undefined') {
			                    	conexao.write(comunicacao.codificaMensagem({
			                            master: 0,
			                            operacao: 'Ação autorizada',
			                            mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
			                            mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
			                            equipamento: equipamento,
			                            sentido: decodificacao.sentido
			                   		}));
			                   	}

			                   	if(callback && callback !== 'undefined') {
									callback(0, configuracao.mensagem.acesso_liberado_linha1 + ' ' +configuracao.mensagem.acesso_liberado_linha2);
									self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
								}

		                    }
						}
	                });
	            }
			});	// fim card
		} // fim !err && ! princeTable
	};

	liberacao.verificaPrePago = function(decodificacao, equipamento, cliente, configuracao, conexao, terminal, callback) {
		var self 			= this,
			gerenciador		= require('../controllers/gerenciador-de-tabela');

		console.log('verificaPrePago');
		console.log('typeof callback '+typeof callback);
		console.log('decodificacao.sentido '+decodificacao.sentido);

		if(decodificacao.sentido === 'Entrada') {
			
			this.verificaVagaDisponivel(decodificacao, equipamento, cliente, 'Pré-Pago', configuracao, conexao, terminal,function(err, message) {
				if(err && callback && callback !== 'undefined' && message) {
					callback(1, message);
				}
				
				if(!err) {
					// console.log('criando nova entrada no banco de dados');

					// cria a entrada do pre pago

					console.log('equipamento');
					console.log(equipamento);

					var cartao = new Card({
						_cliente: cliente._id,
						nome: cliente.nome,
						data_fim: null,
						sempre_liberado: false,
						liberado: false,
						tipo: 'Pré-Pago',
						data_inicio: new Date(),
						data_cadastro: new Date(),
						codigos: [decodificacao.matricula],
						excluido: {
				        	data_hora: null
				        },
				        _equipamento: (equipamento && equipamento._id ? equipamento._id : null),
						equipamento: {
						    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
					    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
						},
						_terminal: (terminal && terminal._id ? terminal._id : null),
						terminal: {
						    nome: (terminal && terminal.nome ? terminal.nome : ''),
					    	numero: (terminal && terminal.numero ? terminal.numero : '')
						},
					});

					cartao.save(function(err) {
						if(!err) {
							self.insereMovimentoPatio({
								_cliente: cliente._id,
								nome: cliente.nome,
								codigo: decodificacao.matricula,
								tipo: cliente.tipo,
								descricao: '',
								sentido: decodificacao.sentido,
								autorizado: true,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
					                master: 0,
					                operacao: 'Ação autorizada',
					                mensagem_linha1: configuracao.mensagem.entrada_liberado_linha1,
					                mensagem_linha2: 'SALDO R$ '+cliente.saldo,
					                equipamento: equipamento,
					                sentido: decodificacao.sentido
					       		}));
							}

							if(callback && callback !== 'undefined') {
								callback(0, configuracao.mensagem.entrada_liberado_linha1+', SALDO ATUAL R$ '+cliente.saldo);
								self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.entrada_liberado_linha1, 'SALDO ATUAL R$ '+cliente.saldo);
							}

						} else {
							console.log('\nerr: '+err);

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
					                master: 0,
					                operacao: 'Ação negada',
					                mensagem_linha1: 'ERRO INTERNO',
					                mensagem_linha2: 'TENTE NOVAMENTE',
					                equipamento: equipamento
					       		}));
							}

							if(callback && callback !== 'undefined') {
								callback(1, 'ERRO INTERNO 95, TENTE NOVAMENTE');
							}

						}
					});
				}
			});
		}
		
		if(decodificacao.sentido === 'Saída') {
			
			console.log('Saída');

			var envio = {};
			var idGerenciador = undefined;
			if(cliente.tabela && cliente.tabela._id && cliente.tabela._id !== '')
				envio.tabela = cliente.tabela._id;

			if(cliente['gerenciador-ou-tabela'] && cliente['gerenciador-ou-tabela'] === 'Gerenciador'){
				if(cliente.gerenciador && cliente.gerenciador._id)
				idGerenciador = cliente.gerenciador._id;
			}

			
			if(cliente['gerenciador-ou-tabela'] && cliente['gerenciador-ou-tabela'] === 'Gerenciador'){
				Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null}, function(err, cardGerenciador) {
					if(!err && cardGerenciador){
						gerenciador.findTable(new Date(), idGerenciador, cardGerenciador,executarFind);
					}else{
						executarFind(envio);
					}
				});
			}else
				executarFind(envio);

			function executarFind(dados){
				console.log('===============================================')
				console.log('IMPRESSÃO DOS DADOS');
				console.log(dados);
				helper.findPriceTable('Permanência', dados.tabela, function(err, priceTable) {
					if(err || !priceTable) {
	
						if(conexao && conexao !== 'undefined') {
							conexao.write(comunicacao.codificaMensagem({
								master: 0,
								operacao: 'Ação negada',
								mensagem_linha1: 'TABELA PRE PAGO',
								mensagem_linha2: 'NAO ENCONTRADA',
								equipamento: equipamento
							   }));
						   }
	
						   if(callback && callback !== 'undefined') {
							callback(1, 'TABELA PRE PAGO NÃO ENCONTRADA');
						}
	
					} else {
						console.log('===============================================')
						console.log('TABELA ENCONTRADA')
						console.log(priceTable);
						console.log('===============================================')
						console.log('CODIGO DO CLIENTE PRÉ-PAGO');
						console.log(decodificacao.matricula);

						Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null}, function(err, card) {
							if(!card) {
								// precisa ter entrado para poder sair, ou seja, nao tem entrada offline para pre-pagos
								console.log('ENTROU AQUI SEM CARD')
								self.insereMovimentoPatio({
									_cliente: cliente._id,
									nome: cliente.nome,
									codigo: decodificacao.matricula,
									tipo: 'Pré-Pago',
									descricao: 'A ENTRADA DO CLIENTE NAO FOI ENCONTRADA',
									sentido: decodificacao.sentido,
									autorizado: false,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
										nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
										numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
										nome: (terminal && terminal.nome ? terminal.nome : ''),
										numero: (terminal && terminal.numero ? terminal.numero : '')
									},
								});	
	
								if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
										master: 0,
										operacao: 'Ação negada',
										mensagem_linha1: 'DESCULPE SUA ENTRADA',
										mensagem_linha2: 'NAO FOI ENCONTRADA',
										equipamento: equipamento
									   }));
								   }
	
								   if(callback && callback !== 'undefined') {
									callback(1, 'A ENTRADA NAO FOI ENCONTRADA.');
								}
	
							} else {
								console.log('===============================================')
								console.log('CARTÃO DO CLIENTE');
								
								card = card.toObject();
								console.log(card);
								var liberado = false;
								var pagamento = {};
								var hora_inicial = null;
								var milliSeconds = moment(moment()).diff(dados['horario-cobrado']? dados['horario-cobrado'] : moment(card.data_inicio));
								var saldoAntigo = cliente.saldo;
								console.log('===============================================')
								console.log('MILISEGUNDOS ' + milliSeconds);
	
								card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
								card.permanencia = helper.formataHora(card.permanencia);
								// console.log('\ncard.data_inicio: '+card.data_inicio);
								// console.log('\ncard.permanencia: '+card.permanencia);
	
	
								// verifica tolerancia de entrada
								// console.log('\npriceTable.tolerancia_entrada: '+priceTable.tolerancia_entrada);
								if(dados['horario-cobrado']){
									hora_inicial = dados['horario-cobrado'];
								console.log('===============================================')
								console.log('MOMENTO INICIAL ' + moment(card.data_inicio).format('DD/MM/YYYY hh:mm:ss'));
								console.log('MOMENTO COBRADO ' + dados['horario-cobrado'].format('DD/MM/YYYY hh:mm:ss'));

								}

								if(priceTable && priceTable.tolerancia_entrada && priceTable.tolerancia_entrada !== '' && priceTable.tolerancia_entrada !== '00:00') {
									var tolerancia = priceTable.tolerancia_entrada.split(':');
									var timeStampLimiteSaida	= dados['horario-cobrado'] ? dados['horario-cobrado'].add({hours: tolerancia[0], minutes: tolerancia[1]}) : moment(card.data_inicio).add({hours: tolerancia[0], minutes: tolerancia[1]});
									var timeStampDataHoraAtual	= moment(moment()).valueOf();
	
									if(timeStampDataHoraAtual <= timeStampLimiteSaida) {
										pagamento.total = '0,00';
										card.tolerancia = true;
										liberado = true;
										// console.log('\ndentro da tolerancia');
									} else {
										// console.log('\nfora da tolerancia');
									}
								}
	
								// console.log('BBB');
								// console.log('liberado '+liberado);
	
								if(!liberado) {
									console.log('===============================================')
									console.log('CLIENTE NÃO ESTÁ LIBERADO CALCULANDO DÉBITO EM CONTA');
									var precoTabela = Caixa.calculaPrecoTabela(card.permanencia, priceTable);
	
									if(typeof precoTabela !== 'object' || !precoTabela) {
										
										if(conexao && conexao !== 'undefined') {
											conexao.write(comunicacao.codificaMensagem({
												master: 0,
												operacao: 'Ação negada',
												mensagem_linha1: 'ERRO INTERNO',
												mensagem_linha2: 'TENTE NOVAMENTE',
												equipamento: equipamento
											   }));
										   }
	
										   if(callback && callback !== 'undefined') {
											callback(1, 'ERRO INTERNO 106, TENTE NOVAMENTE.');
										}
	
										   return;
	
									} else {
										if( helper.moeda2float(cliente.saldo) >= helper.moeda2float(precoTabela.valor)) {
											cliente.saldo = helper.moeda2float(cliente.saldo) - helper.moeda2float(precoTabela.valor);
											cliente.saldo = helper.float2moeda(cliente.saldo);
											
											pagamento = {
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: (equipamento && equipamento.nome ? equipamento.nome : ''),
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: (terminal && terminal.nome ? terminal.nome : ''),
												total: precoTabela.valor,
												valor_recebido: precoTabela.valor,
												forma_pagamento: 'Crédito Pré-Pago',
												data_hora: new Date(),
												tabela: {
													id: priceTable._id,
													nome: priceTable.nome,
													// valor: precoTabela.valor,
													hora: precoTabela.hora
												},
												excluido: {
													data_hora: null
												},
											};
	
											card.pagamento.push(pagamento);
	
											// console.log('card');
											// console.log(card);
	
											// console.log('========================');
											// console.log('pagamento');
											// console.log(pagamento);
	
											liberado = true;
	
											// console.log('cxz');
	
										} else {
	
											self.insereMovimentoPatio({
												_cliente: cliente._id,
												nome: cliente.nome,
												codigo: decodificacao.matricula,
												tipo: 'Pré-Pago',
												descricao: 'SALDO INSUFICIENTE',
												sentido: decodificacao.sentido,
												autorizado: false,
												_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
												equipamento: {
													nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
													numero: (equipamento && equipamento.numero ? equipamento.numero : '')
												},
												_terminal: (terminal && terminal._id ? terminal._id : null),
												terminal: {
													nome: (terminal && terminal.nome ? terminal.nome : ''),
													numero: (terminal && terminal.numero ? terminal.numero : '')
												},
											});	
	
											if(conexao && conexao !== 'undefined') {
												conexao.write(comunicacao.codificaMensagem({
													master: 0,
													operacao: 'Ação negada',
													mensagem_linha1: 'TOTAL R$ '+precoTabela.valor,//+ ' SALDO R$ '+cliente.saldo,
													mensagem_linha2: configuracao.mensagem.saldo_insuficiente_linha2,
													equipamento: equipamento
												   }));
											}
	
											if(callback && callback !== 'undefined') {
												callback(1, 'TOTAL R$ '+precoTabela.valor+' '+configuracao.mensagem.saldo_insuficiente_linha2);
											}
	
											// console.log('a123');
	
											return;
										}
									}
								}
	
								if(liberado) {
									// console.log('ccc');
									console.log('===============================================')
									console.log('CLIENTE ESTÁ LIBERADO');
	
									card.data_fim = new Date();
	
									if(equipamento && equipamento._id) {
										card._equipamento_saida = equipamento._id;
										card.equipamento_saida = {
											nome: equipamento.nome,
											numero: equipamento.numero
										}
									}
	
									if(terminal && terminal._id) {
										card._terminal_saida = terminal._id;
										card.terminal_saida = {
											nome: terminal.nome,
											numero: terminal.numero
										}
									}
	
									Card.findOneAndUpdate({_id: card._id}, card, { upsert: false, new: true }, function (err, card) {
										if(err) console.log(err);
	
									//	console.log(card);
										if(!err && card) {
											Cliente.findOneAndUpdate({_id: cliente._id}, cliente, { upsert: false, new: true }, function (err, cliente) {
												// console.log('ddd');
												console.log('===============================================')
												console.log('DEU TUDO CERTO');
	
												// altera o cliente e o cartao
												if(!err && cliente) {
													
	
													self.insereMovimentoPatio({
														_cliente: cliente._id,
														nome: cliente.nome,
														codigo: decodificacao.matricula,
														tipo: cliente.tipo,
														descricao: '',
														sentido: decodificacao.sentido,
														autorizado: true,
														_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
														equipamento: {
															nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
															numero: (equipamento && equipamento.numero ? equipamento.numero : '')
														},
														_terminal: (terminal && terminal._id ? terminal._id : null),
														terminal: {
															nome: (terminal && terminal.nome ? terminal.nome : ''),
															numero: (terminal && terminal.numero ? terminal.numero : '')
														},
													});
	
													// console.log('eee');
	
													if(conexao && conexao !== 'undefined') {
														conexao.write(comunicacao.codificaMensagem({
															master: 0,
															operacao: 'Ação autorizada',
															mensagem_linha1: 'TOTAL R$ '+pagamento.total,//+ ' SALDO R$ '+saldoAntigo,
															mensagem_linha2: 'SALDO R$ '+cliente.saldo,
															equipamento: equipamento,
															sentido: decodificacao.sentido
														   }));
													   }
	
													   if(callback && callback !== 'undefined') {
														callback(0, 'TOTAL R$ '+pagamento.total + ' SALDO RESTANTE R$ '+cliente.saldo);
														self.disparaRele(decodificacao.sentido, terminal, 'TOTAL R$ '+pagamento.total, 'SALDO R$ '+cliente.saldo);
													}
	
												}
	
											});
										}
									});
								} // fim liberado
	
							} // else card
						});	// fim card
					} // fim !err && ! princeTable
				}); // fim priceTable
			}


















































			// helper.findPriceTable('Permanência', idTabela, function(err, priceTable) {
			// 	if(err || !priceTable) {

			// 		if(conexao && conexao !== 'undefined') {
			// 			conexao.write(comunicacao.codificaMensagem({
			//                 master: 0,
			//                 operacao: 'Ação negada',
			//                 mensagem_linha1: 'TABELA PRE PAGO',
			//                 mensagem_linha2: 'NAO ENCONTRADA',
			//                 equipamento: equipamento
			//        		}));
			//        	}

			//        	if(callback && callback !== 'undefined') {
			// 			callback(1, 'TABELA PRE PAGO NÃO ENCONTRADA');
			// 		}

			// 	} else {
					
			// 		Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null}, function(err, card) {
			// 			if(!card) {
			// 				// precisa ter entrado para poder sair, ou seja, nao tem entrada offline para pre-pagos
			// 				self.insereMovimentoPatio({
			// 					_cliente: cliente._id,
			// 					nome: cliente.nome,
			// 					codigo: decodificacao.matricula,
			// 					tipo: 'Pré-Pago',
			// 					descricao: 'A ENTRADA DO CLIENTE NAO FOI ENCONTRADA',
			// 					sentido: decodificacao.sentido,
			// 					autorizado: false,
			// 					_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
			// 					equipamento: {
			// 					    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
			// 				    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
			// 					},
			// 					_terminal: (terminal && terminal._id ? terminal._id : null),
			// 					terminal: {
			// 					    nome: (terminal && terminal.nome ? terminal.nome : ''),
			// 				    	numero: (terminal && terminal.numero ? terminal.numero : '')
			// 					},
			// 				});	

			// 				if(conexao && conexao !== 'undefined') {
			// 					conexao.write(comunicacao.codificaMensagem({
			// 		                master: 0,
			// 		                operacao: 'Ação negada',
			// 		                mensagem_linha1: 'DESCULPE SUA ENTRADA',
			// 		                mensagem_linha2: 'NAO FOI ENCONTRADA',
			// 		                equipamento: equipamento
			// 		       		}));
			// 		       	}

			// 		       	if(callback && callback !== 'undefined') {
			// 					callback(1, 'A ENTRADA NAO FOI ENCONTRADA.');
			// 				}

			// 			} else {

			// 				card = card.toObject();

			// 				var liberado = false;
			// 				var pagamento = {};
			// 				var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
			// 				var saldoAntigo = cliente.saldo;

			// 				card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
			// 				card.permanencia = helper.formataHora(card.permanencia);
			// 				// console.log('\ncard.data_inicio: '+card.data_inicio);
			// 				// console.log('\ncard.permanencia: '+card.permanencia);


			// 				// verifica tolerancia de entrada
			// 				// console.log('\npriceTable.tolerancia_entrada: '+priceTable.tolerancia_entrada);
			//         		if(priceTable && priceTable.tolerancia_entrada && priceTable.tolerancia_entrada !== '' && priceTable.tolerancia_entrada !== '00:00') {

			// 					var tolerancia = priceTable.tolerancia_entrada.split(':');
			// 					var timeStampLimiteSaida = moment(card.data_inicio).add({hours: tolerancia[0], minutes: tolerancia[1]});
			//         			var timeStampDataHoraAtual = moment(moment()).valueOf();

			//         			if(timeStampDataHoraAtual <= timeStampLimiteSaida) {
			//         				pagamento.total = '0,00';
			//             			card.tolerancia = true;
			//             			liberado = true;
			//             			// console.log('\ndentro da tolerancia');
			//         			} else {
			//         				// console.log('\nfora da tolerancia');
			//         			}
			//         		}

			//         		console.log('BBB');
			//         		console.log('liberado '+liberado);

			//         		if(!liberado) {
			// 					var precoTabela = Caixa.calculaPrecoTabela(card.permanencia, priceTable);

			// 					if(typeof precoTabela !== 'object' || !precoTabela) {
									
			// 						if(conexao && conexao !== 'undefined') {
			// 							conexao.write(comunicacao.codificaMensagem({
			// 				                master: 0,
			// 				                operacao: 'Ação negada',
			// 				                mensagem_linha1: 'ERRO INTERNO',
			// 				                mensagem_linha2: 'TENTE NOVAMENTE',
			// 				                equipamento: equipamento
			// 				       		}));
			// 				       	}

			// 				       	if(callback && callback !== 'undefined') {
			// 							callback(1, 'ERRO INTERNO 106, TENTE NOVAMENTE.');
			// 						}

			// 			       		return;

			// 					} else {
			// 						if( helper.moeda2float(cliente.saldo) >= helper.moeda2float(precoTabela.valor)) {
			// 							cliente.saldo = helper.moeda2float(cliente.saldo) - helper.moeda2float(precoTabela.valor);
			// 							cliente.saldo = helper.float2moeda(cliente.saldo);
										
			// 							pagamento = {
			// 								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
			// 								equipamento: (equipamento && equipamento.nome ? equipamento.nome : ''),
			// 								_terminal: (terminal && terminal._id ? terminal._id : null),
			// 								terminal: (terminal && terminal.nome ? terminal.nome : ''),
			// 								total: precoTabela.valor,
			// 								valor_recebido: precoTabela.valor,
			// 								forma_pagamento: 'Crédito Pré-Pago',
			// 								data_hora: new Date(),
			// 								tabela: {
			// 									id: priceTable._id,
			// 									nome: priceTable.nome,
			// 									// valor: precoTabela.valor,
			// 									hora: precoTabela.hora
			// 								},
			// 								excluido: {
			// 				                	data_hora: null
			// 				                },
			// 							};









			// 							card.pagamento.push(pagamento);

			// 							console.log('card');
			// 							console.log(card);

			// 							console.log('========================');
			// 							console.log('pagamento');
			// 							console.log(pagamento);

			// 							liberado = true;

			// 							console.log('cxz');

			// 						} else {

			// 							self.insereMovimentoPatio({
			// 								_cliente: cliente._id,
			// 								nome: cliente.nome,
			// 								codigo: decodificacao.matricula,
			// 								tipo: 'Pré-Pago',
			// 								descricao: 'SALDO INSUFICIENTE',
			// 								sentido: decodificacao.sentido,
			// 								autorizado: false,
			// 								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
			// 								equipamento: {
			// 								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
			// 							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
			// 								},
			// 								_terminal: (terminal && terminal._id ? terminal._id : null),
			// 								terminal: {
			// 								    nome: (terminal && terminal.nome ? terminal.nome : ''),
			// 							    	numero: (terminal && terminal.numero ? terminal.numero : '')
			// 								},
			// 							});	

			// 							if(conexao && conexao !== 'undefined') {
			// 								conexao.write(comunicacao.codificaMensagem({
			// 		                            master: 0,
			// 		                            operacao: 'Ação negada',
			// 		                            mensagem_linha1: 'TOTAL R$ '+precoTabela.valor,//+ ' SALDO R$ '+cliente.saldo,
			// 		                            mensagem_linha2: configuracao.mensagem.saldo_insuficiente_linha2,
			// 		                            equipamento: equipamento
			// 		                   		}));
			// 			                }

			// 			                if(callback && callback !== 'undefined') {
			// 								callback(1, 'TOTAL R$ '+precoTabela.valor+' '+configuracao.mensagem.saldo_insuficiente_linha2);
			// 							}

			// 							console.log('a123');

			// 							return;
			// 						}
			// 					}
			// 				}

			// 				if(liberado) {
			// 					console.log('ccc');

			// 					card.data_fim = new Date();

			// 					if(equipamento && equipamento._id) {
			// 						card._equipamento_saida = equipamento._id;
			// 						card.equipamento_saida = {
			// 						    nome: equipamento.nome,
			// 					    	numero: equipamento.numero
			// 						}
			// 					}

			// 					if(terminal && terminal._id) {
			// 						card._terminal_saida = terminal._id;
			// 						card.terminal_saida = {
			// 						    nome: terminal.nome,
			// 					    	numero: terminal.numero
			// 						}
			// 					}

			// 					Card.findOneAndUpdate({_id: card._id}, card, { upsert: false, new: true }, function (err, card) {
			// 						if(err) console.log(err);

			// 						console.log(card);
			// 						if(!err && card) {
			// 							Cliente.findOneAndUpdate({_id: cliente._id}, cliente, { upsert: false, new: true }, function (err, cliente) {
			// 								console.log('ddd');

			// 		                    	// altera o cliente e o cartao
			// 			                    if(!err && cliente) {

			// 			                    	self.insereMovimentoPatio({
			// 										_cliente: cliente._id,
			// 										nome: cliente.nome,
			// 										codigo: decodificacao.matricula,
			// 										tipo: cliente.tipo,
			// 										descricao: '',
			// 										sentido: decodificacao.sentido,
			// 										autorizado: true,
			// 										_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
			// 										equipamento: {
			// 										    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
			// 									    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
			// 										},
			// 										_terminal: (terminal && terminal._id ? terminal._id : null),
			// 										terminal: {
			// 										    nome: (terminal && terminal.nome ? terminal.nome : ''),
			// 									    	numero: (terminal && terminal.numero ? terminal.numero : '')
			// 										},
			// 									});

			// 									console.log('eee');

			// 			                    	if(conexao && conexao !== 'undefined') {
			// 				                    	conexao.write(comunicacao.codificaMensagem({
			// 				                            master: 0,
			// 				                            operacao: 'Ação autorizada',
			// 				                            mensagem_linha1: 'TOTAL R$ '+pagamento.total,//+ ' SALDO R$ '+saldoAntigo,
			// 				                            mensagem_linha2: 'SALDO R$ '+cliente.saldo,
			// 				                            equipamento: equipamento,
			// 				                            sentido: decodificacao.sentido
			// 				                   		}));
			// 				                   	}

			// 				                   	if(callback && callback !== 'undefined') {
			// 										callback(0, 'TOTAL R$ '+pagamento.total + ' SALDO RESTANTE R$ '+cliente.saldo);
			// 										self.disparaRele(decodificacao.sentido, terminal, 'TOTAL R$ '+pagamento.total, 'SALDO R$ '+cliente.saldo);
			// 									}

			// 			                    }

			// 		                    });
			// 						}
			// 	                });
			// 	            } // fim liberado

			// 			} // else card
			// 		});	// fim card
			// 	} // fim !err && ! princeTable
			// }); // fim priceTable
		} // fim saida
	};

	liberacao.verificaPermanencia = function(decodificacao, equipamento, cliente, configuracao, conexao, terminal, callback) {
		var liberado = false;
		var upsert = false;
		var pattern = helper.decodeBarcode(decodificacao.matricula);
		var self = this;

		if(decodificacao.sentido === 'Entrada') { // praticamente nunca vai entrar aqui // ticket de entrada somente sai

			if(conexao && conexao !== 'undefined') {
				conexao.write(comunicacao.codificaMensagem({
		            master: 0,
		            operacao: 'Ação negada',
		            mensagem_linha1: 'POR FAVOR',
		            mensagem_linha2: 'UTILIZE A SAIDA',
		            equipamento: equipamento
		   		}));
		   	}

			self.insereMovimentoPatio({
				_cliente: null,
				nome: 'SEM CADASTRO',
				codigo: decodificacao.matricula,
				tipo: 'Permanência',
				descricao: 'UTILIZE A SAIDA',
				sentido: decodificacao.sentido,
				autorizado: false,
				_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
				equipamento: {
				    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
			    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
				},
				_terminal: (terminal && terminal._id ? terminal._id : null),
				terminal: {
				    nome: (terminal && terminal.nome ? terminal.nome : ''),
			    	numero: (terminal && terminal.numero ? terminal.numero : '')
				},
			});	
	
			if(callback && callback !== 'undefined') {
				callback(1, 'ESTE TICKET SOMENTE PODE SAIR.');
			}

		}

		if(decodificacao.sentido === 'Saída') {

			console.log('decodificacao');
			console.log(decodificacao);

			PriceTable.findOne({tipo: 'Permanência', ativo: true, padrao: true}, function(err, priceTable) {
				                                	
				if(err || !priceTable) {
					// console.log('\nerr: '+err);
					if(conexao && conexao !== 'undefined') {
						conexao.write(comunicacao.codificaMensagem({
				            master: 0,
				            operacao: 'Ação negada',
				            mensagem_linha1: 'TABELA POR PERMANENCIA',
				            mensagem_linha2: 'NAO ENCONTRADA',
				            equipamento: equipamento
				        }));
				    }

				    if(callback && callback !== 'undefined') {
						callback(1, 'TABELA POR PERMANÊNCIA NÃO ENCONTRADA.');
					}
			        return;
				}

				console.log(44444);

				// recupera o cartao que ainda não saiu
			    Card.findOne({ codigos: decodificacao.matricula, 'excluido.data_hora': null}, function(err, card) {
			    	if(card)
			    		card = card.toObject();

			    	if(!card) {

			    		console.log(444445);

			    		// se nao pode ter entrada offline no sistema, entao o cartao PRECISA estar no banco
			    		if(configuracao.app.entrada_offline === false) {
			    			// console.log('\nEste ticket não foi encontrado no banco de dados.');
			    			if(conexao && conexao !== 'undefined') {
				    			conexao.write(comunicacao.codificaMensagem({
				                    master: 0,
				                    operacao: 'Ação negada',
				                    mensagem_linha1: 'TICKET INVALIDO OU',
				                    mensagem_linha2: 'NAO ENCONTRADO',
				                    equipamento: equipamento
				                }));
				            }

							self.insereMovimentoPatio({
								_cliente: null,
								nome: 'SEM CADASTRO',
								codigo: decodificacao.matricula,
								tipo: 'Permanência',
								descricao: 'TICKET INVALIDO OU NAO ENCONTRADO',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});	

							if(callback && callback !== 'undefined') {
								callback(1, 'ERRO INTERNO 96, TENTE NOVAMENTE.');
							}

			                return; // para o fluxo da func
			    		}

			    		// se pode ter entrada offline cria o cartao com base no pattern
						card = {
							_id: new mongoose.Types.ObjectId,
							nome: decodificacao.matricula,
							data_fim: null,
							sempre_liberado: false,
							liberado: false,
							tipo: 'Permanência',
							data_inicio: moment(pattern.dia+'/'+pattern.mes+'/'+pattern.ano+' '+pattern.hora+':'+pattern.minuto, 'DD/MM/YYYY HH:mm'),
							pagamento: [],
							codigos: [decodificacao.matricula],
							ticket: {
								linha1: configuracao.ticket.linha1,
								linha2: configuracao.ticket.linha2,
								linha3: configuracao.ticket.linha3,
								linha4: configuracao.ticket.linha4,
								linha5: configuracao.ticket.linha5,
								linha6: configuracao.ticket.linha6
							},
							excluido: {
			                	data_hora: null
			                },
						};

						upsert = true;

					}


		        	if(card.data_fim) { // somente a leitora 2 é sempre liberada
		        		console.log(444446);
		        		// console.log('\nEste ticket ja saiu');
		        		if(conexao && conexao !== 'undefined') {
			    			conexao.write(comunicacao.codificaMensagem({
			                    master: 0,
			                    operacao: 'Ação negada',
			                    mensagem_linha1: 'TICKET JA UTILIZADO',
			                    mensagem_linha2: '',
			                    equipamento: equipamento
			           		}));
			           	}

		           		self.insereMovimentoPatio({
							_cliente: null,
							nome: 'SEM CADASTRO',
							codigo: decodificacao.matricula,
							tipo: 'Permanência',
							descricao: 'TICKET JA UTILIZADO',
							sentido: decodificacao.sentido,
							autorizado: false,
							_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
							    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
						    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
							    nome: (terminal && terminal.nome ? terminal.nome : ''),
						    	numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});	


						if(callback && callback !== 'undefined') {
							callback(1, 'TICKET JÁ UTILIZADO.');
						}

		           		return;
		    		}

		        	// console.log('\nTicket ainda nao saiu');

					var timeStampLimiteSaida,
						timeStampDataHoraAtual;

		        	if(card.liberado) { // se o cartao foi pago
		        		console.log(444447);

		        		// console.log('\nTicket liberado');
		        		// verifica se está dentro do limite de/para saida

		        		timeStampLimiteSaida = moment(card.limite_saida).valueOf();
		        		timeStampDataHoraAtual = moment(moment()).valueOf();
		            	if(timeStampDataHoraAtual <= timeStampLimiteSaida) {
		            		liberado = true;
		            		console.log('\ndentro do limite de saida');
		            	} else {

		            		// console.log('\nfora do limite de saida');
		            	}

		        	} else { // se o cartao nao foi pago
		        		console.log(444448);
		        		// verifica se ainda está dentro da permanencia de entrada da tabela padrao
		        		if(priceTable && priceTable.tolerancia_entrada && priceTable.tolerancia_entrada !== '' && priceTable.tolerancia_entrada !== '00:00') {

							var tolerancia = priceTable.tolerancia_entrada.split(':');
							timeStampLimiteSaida = moment(card.data_inicio).add({hours: tolerancia[0], minutes: tolerancia[1]});
		        			timeStampDataHoraAtual = moment(moment()).valueOf();

		        			if(timeStampDataHoraAtual <= timeStampLimiteSaida) {
		            			card.tolerancia = true;
		            			liberado = true;
		            			// console.log('\ndentro da tolerancia de entrada');
		        			} else {
		        				// console.log('\nfora da tolerancia');
		        			}
		        		}
		        	}

		        	if(liberado) {
		        		console.log(444449);

					    // salva a permanencia final
					    var milliSeconds = moment(moment(), 'DD/MM/YYYY HH:mm').diff(moment(card.data_inicio, 'DD/MM/YYYY HH:mm'));
						card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
						card.liberado = false;
						card.data_fim = new Date();


						if(equipamento && equipamento._id) {
							card._equipamento_saida = equipamento._id;
							card.equipamento_saida = {
							    nome: equipamento.nome,
						    	numero: equipamento.numero
							}
						}

						if(terminal && terminal._id) {
							card._terminal_saida = terminal._id;
							card.terminal_saida = {
							    nome: terminal.nome,
						    	numero: terminal.numero
							}
						}

						// console.log('cartao liberado')
						// if(upsert)
						// 	console.log('entrada offline');
						// console.log('upsert '+upsert);
						// console.log('tolerancia de entrada'+card.tolerancia);



						Card.findOneAndUpdate({_id: card._id}, card, { upsert: upsert, new: true }, function (err, card) {
							// console.log(1);
							console.log(4444410);
							if(err) console.log(err);
		                    if(!err && card) {
		                    	// console.log(2);
		                    	
								self.insereMovimentoPatio({
									_cliente: null,
									nome: 'SEM CADASTRO',
									codigo: decodificacao.matricula,
									tipo: 'Permanência',
									descricao: '',
									sentido: decodificacao.sentido,
									autorizado: true,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									    nome: (terminal && terminal.nome ? terminal.nome : ''),
								    	numero: (terminal && terminal.numero ? terminal.numero : '')
									},
								});

								if(conexao && conexao !== 'undefined') {
			                    	conexao.write(comunicacao.codificaMensagem({
			                            master: 0,
			                            operacao: 'Ação autorizada',
			                            mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
			                            mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
			                            equipamento: equipamento,
			                   		}));
			                   	}

			                   	if(callback && callback !== 'undefined') {
									callback(0, configuracao.mensagem.acesso_liberado_linha1 + ' ' + configuracao.mensagem.acesso_liberado_linha2);
									self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
								}

								console.log(4444411);
		                    }
		                });

					} else {
						self.insereMovimentoPatio({
							_cliente: null,
							nome: 'SEM CADASTRO',
							codigo: decodificacao.matricula,
							tipo: 'Permanência',
							descricao: configuracao.mensagem.acesso_negado_linha1+' '+configuracao.mensagem.acesso_negado_linha2,
							sentido: decodificacao.sentido,
							autorizado: false,
							_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
							equipamento: {
							    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
						    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
							},
							_terminal: (terminal && terminal._id ? terminal._id : null),
							terminal: {
							    nome: (terminal && terminal.nome ? terminal.nome : ''),
						    	numero: (terminal && terminal.numero ? terminal.numero : '')
							},
						});	

						if(conexao && conexao !== 'undefined') {
							conexao.write(comunicacao.codificaMensagem({
			                    master: 0,
			                    operacao: 'Ação negada',
			                    mensagem_linha1: configuracao.mensagem.acesso_negado_linha1,
			                    mensagem_linha2: configuracao.mensagem.acesso_negado_linha2,
			                    equipamento: equipamento
			           		}));
			           	}

			           	if(callback && callback !== 'undefined') {
							callback(1, configuracao.mensagem.acesso_negado_linha1 + ' ' + configuracao.mensagem.acesso_negado_linha2);
						}			

						console.log(4444412);           	
					}


			    }); // Card.findOne

			}); // fim priceTable.findOne
		}
	};

	liberacao.verificaDiaria = function(decodificacao, equipamento, diaria, configuracao, conexao, terminal, callback) {
		var self = this;

		// adicionar validacao pra ver se a diaria está paga
		if(!diaria.pagamento || !diaria.pagamento.length || !diaria.data_validade_inicio) {
			console.log('a diaria nao tem pagamento');

			if(conexao && conexao !== 'undefined') {
				conexao.write(comunicacao.codificaMensagem({
	                master: 0,
	                operacao: 'Ação negada',
	                mensagem_linha1: 'A DIARIA AINDA NAO',
	                mensagem_linha2: 'TEM PAGAMENTO',
	                equipamento: equipamento
	       		}));
	       	}

       		self.insereMovimentoPatio({
				_cliente: null,
				nome: 'SEM CADASTRO',
				codigo: decodificacao.matricula,
				tipo: 'Diária',
				descricao: 'A DIARIA AINDA NÃO TEM PAGAMENTO',
				sentido: decodificacao.sentido,
				autorizado: false,
				_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
				equipamento: {
				    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
			    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
				},
				_terminal: (terminal && terminal._id ? terminal._id : null),
				terminal: {
				    nome: (terminal && terminal.nome ? terminal.nome : ''),
			    	numero: (terminal && terminal.numero ? terminal.numero : '')
				},
			});	

			if(callback && callback !== 'undefined') {
				callback(1, 'A DIARIA AINDA NÃO TEM PAGAMENTO');
			}
		
			return;
		}


		if(decodificacao.sentido === 'Entrada') {
			// nao vem esse cliente
			console.log('entrada, diaria tem pagamento.');

			// verifica se a data de hoje é maior ou igual a data_validade_inicio 
			var timeStampValidadeInicio = moment(diaria.data_validade_inicio).valueOf();
			var timeStampValidadeFim = moment(diaria.data_validade_fim).valueOf();
			var timeStampDataAtual = moment(moment()).valueOf();

			// console.log('timeStampDataAtual '+timeStampDataAtual);
			// console.log('timeStampValidadeInicio '+timeStampValidadeInicio);
			// console.log('timeStampValidadeFim '+timeStampValidadeFim);

			// console.log(1);
			if(timeStampDataAtual < timeStampValidadeInicio) {
				console.log('ticket valido apartir de xyz');

				if(conexao && conexao !== 'undefined') {
					conexao.write(comunicacao.codificaMensagem({
		                master: 0,
		                operacao: 'Ação negada',
		                mensagem_linha1: 'VALIDO APARTIR',
		                mensagem_linha2: 'DE '+helper.somenteData(diaria.data_validade_inicio),
		                equipamento: equipamento
		       		}));
		       	}
				
	       		self.insereMovimentoPatio({
					_cliente: null,
					nome: 'SEM CADASTRO',
					codigo: decodificacao.matricula,
					tipo: 'Diária',
					descricao: 'TICKET VALIDO APARTIR DE '+helper.somenteData(diaria.data_validade_inicio),
					sentido: decodificacao.sentido,
					autorizado: false,
					_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
					equipamento: {
					    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
				    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
					},
					_terminal: (terminal && terminal._id ? terminal._id : null),
					terminal: {
					    nome: (terminal && terminal.nome ? terminal.nome : ''),
				    	numero: (terminal && terminal.numero ? terminal.numero : '')
					},
				});	

				if(callback && callback !== 'undefined') {
					callback(1, 'TICKET VALIDO APARTIR DE '+helper.somenteData(diaria.data_validade_inicio));
				}
			
				return;
			}

			// console.log(3);
			// e menor ou igual a data_validade_fim
			if(timeStampDataAtual > timeStampValidadeFim) {

				console.log('tickt expirou');

				if(conexao && conexao !== 'undefined') {
					conexao.write(comunicacao.codificaMensagem({
		                master: 0,
		                operacao: 'Ação negada',
		                mensagem_linha1: 'TICKET EXPIROU',
		                mensagem_linha2: 'EM '+helper.somenteData(diaria.data_validade_fim),
		                equipamento: equipamento
		       		}));	
		       	}

				// console.log(4);
	       		self.insereMovimentoPatio({
					_cliente: null,
					nome: 'SEM CADASTRO',
					codigo: decodificacao.matricula,
					tipo: 'Diária',
					descricao: 'TICKET EXPIROU EM '+helper.somenteData(diaria.data_validade_fim),
					sentido: decodificacao.sentido,
					autorizado: false,
					_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
					equipamento: {
					    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
				    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
					},
					_terminal: (terminal && terminal._id ? terminal._id : null),
					terminal: {
					    nome: (terminal && terminal.nome ? terminal.nome : ''),
				    	numero: (terminal && terminal.numero ? terminal.numero : '')
					},
				});	

				if(callback && callback !== 'undefined') {
					callback(1, 'O TICKET EXPIROU EM '+helper.somenteData(diaria.data_validade_fim));
				}
				return;
			}

			console.log(4);
			this.verificaVagaDisponivel(decodificacao, equipamento, {}, 'Diária', configuracao, conexao, terminal, function(err, message) {
				console.log('err: '+err);
				console.log('retorno verificaVagaDisponivel');
				console.log('message: '+message);
				console.log('typeof callback '+typeof callback);
				
				if(err && callback && callback !== 'undefined' && message) {
					console.log(' xxx ');
					callback(1, message);
				}

				if(!err) {
					// console.log('Criando nova entrada de Diária no banco de dados');

					// cria a entrada por diaria
					var cartao = new Card({
						_diaria: diaria._id,
						nome: 'SEM CADASTRO',
						data_fim: null,
						sempre_liberado: false,
						liberado: true,
						tipo: 'Diária',
						data_inicio: new Date(),
						data_cadastro: new Date(),
						codigos: diaria.codigos,
						excluido: {
				        	data_hora: null
				        },
				        _equipamento: (equipamento && equipamento._id ? equipamento._id : null),
						equipamento: {
						    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
					    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
						},
						_terminal: (terminal && terminal._id ? terminal._id : null),
						terminal: {
						    nome: (terminal && terminal.nome ? terminal.nome : ''),
					    	numero: (terminal && terminal.numero ? terminal.numero : '')
						},
			            tipo_veiculo: diaria.tipo_veiculo ? diaria.tipo_veiculo : '',
						carro: {
							placa: diaria.carro.placa ? diaria.carro.placa : '',
							marca: diaria.carro.marca ? diaria.carro.marca : '',
							modelo: diaria.carro.modelo ? diaria.carro.modelo : '',
							cor: diaria.carro.cor ? diaria.carro.cor : '',
						},
					});


					// console.log(8);

					cartao.save(function(err) {
						console.log(' bbb '+err);
						if(!err) {


							console.log(9);
							self.insereMovimentoPatio({
								_diaria: diaria._id,
								nome: 'SEM CADASTRO',
								codigo: diaria.codigos,
								tipo: 'Diária',
								descricao: '',
								sentido: decodificacao.sentido,
								autorizado: true,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
		                            master: 0,
		                            operacao: 'Ação autorizada',
		                            mensagem_linha1: configuracao.mensagem.entrada_liberado_linha1,
		                            mensagem_linha2: configuracao.mensagem.entrada_liberado_linha2,
		                            equipamento: equipamento,
		                   		}));
		                   	}

		                   	console.log('callback '+typeof callback);
		                   	if(callback && callback !== 'undefined') {
								callback(0, configuracao.mensagem.entrada_liberado_linha1 + ' ' + configuracao.mensagem.entrada_liberado_linha2);
								self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.entrada_liberado_linha1, configuracao.mensagem.entrada_liberado_linha2);
							}

						} else {
							// console.log(10);
							// console.log('\nerr: '+err);
							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
					                master: 0,
					                operacao: 'Ação negada',
					                mensagem_linha1: 'ERRO INTERNO',
					                mensagem_linha2: 'TENTE NOVAMENTE',
					                equipamento: equipamento
					       		}));
					       	}

					       	if(callback && callback !== 'undefined') {
								callback(1, 'ERRO INTERNO 97, TENTE NOVAMENTE.');
							}

						}
					});
				}
			});
		}
		
		if(decodificacao.sentido === 'Saída') {
			// console.log('\nSAIDA DIARIA');


			var idTabela;
			if(diaria.tabela && diaria.tabela._id && diaria.tabela._id !== '')
				idTabela = diaria.tabela._id;

			helper.findPriceTable('Diária', idTabela, function(err, priceTable) {
				if(err || !priceTable) {

					if(conexao && conexao !== 'undefined') {
						conexao.write(comunicacao.codificaMensagem({
			                master: 0,
			                operacao: 'Ação negada',
			                mensagem_linha1: 'TABELA POR DIARIA',
			                mensagem_linha2: 'NAO ENCONTRADA',
			                equipamento: equipamento
			       		}));
			       	}

				} else {
					
					Card.findOne({ codigos: decodificacao.matricula, data_fim: null, 'excluido.data_hora': null}, function(err, card) {
						if(!card) {
							// precisa ter entrado para poder sair, ou seja, nao tem entrada offline para pre-pagos
							self.insereMovimentoPatio({
								_diaria: diaria._id,
								nome: 'SEM CADASTRO',
								codigo: decodificacao.matricula,
								tipo: 'Diária',
								descricao: 'A ENTRADA NAO FOI ENCONTRADA',
								sentido: decodificacao.sentido,
								autorizado: false,
								_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
								equipamento: {
								    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
							    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
								},
								_terminal: (terminal && terminal._id ? terminal._id : null),
								terminal: {
								    nome: (terminal && terminal.nome ? terminal.nome : ''),
							    	numero: (terminal && terminal.numero ? terminal.numero : '')
								},
							});	

							if(conexao && conexao !== 'undefined') {
								conexao.write(comunicacao.codificaMensagem({
					                master: 0,
					                operacao: 'Ação negada',
					                mensagem_linha1: 'DESCULPE SUA ENTRADA',
					                mensagem_linha2: 'NAO FOI ENCONTRADA',
					                equipamento: equipamento
					       		}));
					       	}

							if(callback && callback !== 'undefined') {
								callback(1, 'A ENTRADA NÃO FOI ENCONTRADA.');
							}

						} else {

							card = card.toObject();

							// verifica tolerancia de saída
							if(priceTable.tolerancia_saida && priceTable.tolerancia_saida !== '' && priceTable.tolerancia_saida !== '00:00') {
								var tolerancia = priceTable.tolerancia_saida.split(':');
								diaria.data_validade_fim = moment(diaria.data_validade_fim).add({hours: tolerancia[0], minutes: tolerancia[1]});
							}


							var timeStampValidadeFim = moment(diaria.data_validade_fim).valueOf();
							var timeStampDataAtual = moment(moment()).valueOf();

							if(timeStampDataAtual > timeStampValidadeFim) {

								if(conexao && conexao !== 'undefined') {
									conexao.write(comunicacao.codificaMensagem({
						                master: 0,
						                operacao: 'Ação negada',
						                mensagem_linha1: 'TICKET EXPIROU',
						                mensagem_linha2: 'EM '+helper.formataData(diaria.data_validade_fim),
						                equipamento: equipamento
						       		}));
								}

					       		self.insereMovimentoPatio({
									_cliente: null,
									nome: 'SEM CADASTRO',
									codigo: decodificacao.matricula,
									tipo: 'Diária',
									descricao: 'TICKET EXPIROU EM '+helper.formataData(diaria.data_validade_fim),
									sentido: decodificacao.sentido,
									autorizado: false,
									_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
									equipamento: {
									    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
								    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
									},
									_terminal: (terminal && terminal._id ? terminal._id : null),
									terminal: {
									    nome: (terminal && terminal.nome ? terminal.nome : ''),
								    	numero: (terminal && terminal.numero ? terminal.numero : '')
									},
								});	

								if(callback && callback !== 'undefined') {
									callback(1, 'O TICKET EXPIROU EM '+helper.formataData(diaria.data_validade_fim));
								}

							} else {

								// calcula a permanencia
								var milliSeconds = moment(moment()).diff(moment(card.data_inicio));
								card.permanencia = Math.floor(moment.duration(milliSeconds).asHours()) + moment.utc(milliSeconds).format(':mm');
								card.permanencia = helper.formataHora(card.permanencia);

								card.data_fim = new Date();

								if(equipamento && equipamento._id) {
									card._equipamento_saida = equipamento._id;
									card.equipamento_saida = {
									    nome: equipamento.nome,
								    	numero: equipamento.numero
									}
								}

								if(terminal && terminal._id) {
									card._terminal_saida = terminal._id;
									card.terminal_saida = {
									    nome: terminal.nome,
								    	numero: terminal.numero
									}
								}


								Card.findOneAndUpdate({_id: card._id}, card, { upsert: false, new: true }, function (err, card) {
									if(!err && card) {
				                    
				                    	self.insereMovimentoPatio({
											_diaria: diaria._id,
											nome: 'SEM CADASTRO',
											codigo: decodificacao.matricula,
											tipo: 'Diária',
											descricao: '',
											sentido: decodificacao.sentido,
											autorizado: true,
											_equipamento: (equipamento && equipamento._id ? equipamento._id : null),
											equipamento: {
											    nome: (equipamento && equipamento.nome ? equipamento.nome : ''),
										    	numero: (equipamento && equipamento.numero ? equipamento.numero : '')
											},
											_terminal: (terminal && terminal._id ? terminal._id : null),
											terminal: {
											    nome: (terminal && terminal.nome ? terminal.nome : ''),
										    	numero: (terminal && terminal.numero ? terminal.numero : '')
											},
										});

				                    	if(conexao && conexao !== 'undefined') {
					                    	conexao.write(comunicacao.codificaMensagem({
							                    master: 0,
							                    operacao: 'Ação autorizada',
							                    mensagem_linha1: configuracao.mensagem.acesso_liberado_linha1,
							                    mensagem_linha2: configuracao.mensagem.acesso_liberado_linha2,
							                    equipamento: equipamento,
							                    sentido: decodificacao.sentido
							           		}));
							           	}

							           	if(callback && callback !== 'undefined') {
											callback(0, configuracao.mensagem.acesso_liberado_linha1 + ' ' + configuracao.mensagem.acesso_liberado_linha2);
											self.disparaRele(decodificacao.sentido, terminal, configuracao.mensagem.acesso_liberado_linha1, configuracao.mensagem.acesso_liberado_linha2);
										}
				                    } else {
										// console.log(10);
										// console.log('\nerr: '+err);
										if(conexao && conexao !== 'undefined') {
											conexao.write(comunicacao.codificaMensagem({
								                master: 0,
								                operacao: 'Ação negada',
								                mensagem_linha1: 'ERRO INTERNO',
								                mensagem_linha2: 'TENTE NOVAMENTE',
								                equipamento: equipamento
								       		}));
								       	}

								       	if(callback && callback !== 'undefined') {
											callback(1, 'ERRO INTERNO 90, TENTE NOVAMENTE.');
										}
									}


				                });
				            } // fim timeStamp

						} // else card
					});	// fim card
				} // fim !err && ! princeTable
			}); // fim priceTable
		} // fim saida
	};

	return liberacao;
}

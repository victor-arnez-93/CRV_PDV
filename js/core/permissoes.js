window.crvPermissoes = (() => {

  let operadorSelecionado = null;
  let operadoresCache = [];

  function valorCampo(id) {
    return String(document.getElementById(id)?.value || "").trim();
  }

  function normalizarUsuarioOperador(usuario) {
    return String(usuario || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9._-]/g, "");
  }

  function labelModulo(codigo) {
    const labels = {
      dashboard: "Dashboard",
      caixa: "Caixa / PDV",
      comandas: "Comandas",
      agenda: "Agenda",
      vendas: "Vendas",
      produtos: "Produtos",
      clientes: "Clientes",
      relatorios: "Relatórios",
      configuracoes: "Configurações"
    };

    return labels[codigo] || codigo;
  }

  function labelPermissaoEspecial(codigo) {
    const labels = {
      venda_manual: "Venda manual",
      desconto: "Aplicar desconto",
      cancelar_venda: "Cancelar venda",
      abrir_caixa: "Abrir caixa",
      fechar_caixa: "Fechar caixa",
      editar_jogador: "Editar jogador",
      remover_jogador: "Remover jogador",
      enviar_jogador_comanda: "Enviar jogador para comanda",
      alterar_preco_manual: "Alterar preço manual",
      ver_relatorios: "Ver relatórios",
      configurar_empresa: "Configurar empresa"
    };

    return labels[codigo] || codigo;
  }

  function labelPerfil(perfil) {
    const labels = {
      admin: "Admin",
      gerente: "Gerente",
      operador: "Operador",
      caixa: "Caixa",
      agenda: "Agenda",
      relatorios: "Relatórios"
    };

    return labels[String(perfil || "").toLowerCase()] || perfil || "Operador";
  }

  function perfilPadraoPermissoes(perfil) {
    const permissoes = {
      admin: [
        "dashboard",
        "caixa",
        "comandas",
        "agenda",
        "vendas",
        "produtos",
        "clientes",
        "relatorios",
        "configuracoes"
      ],

      gerente: [
        "dashboard",
        "caixa",
        "comandas",
        "agenda",
        "vendas",
        "produtos",
        "clientes",
        "relatorios"
      ],

      caixa: [
        "dashboard",
        "caixa",
        "comandas",
        "agenda",
        "vendas"
      ],

      agenda: [
        "dashboard",
        "agenda",
        "clientes"
      ],

      relatorios: [
        "dashboard",
        "vendas",
        "relatorios"
      ],

      operador: [
        "dashboard",
        "caixa",
        "comandas",
        "vendas"
      ]
    };

    return permissoes[perfil] || permissoes.operador;
  }

  function permissoesEspeciaisPorPerfil(perfil) {
    const perfilNormalizado = String(perfil || "operador").toLowerCase();

    return {
      venda_manual: perfilNormalizado === "admin",
      desconto: true,
      cancelar_venda: true,
      abrir_caixa: true,
      fechar_caixa: true,
      editar_jogador: true,
      remover_jogador: true,
      enviar_jogador_comanda: true,
      alterar_preco_manual: true,
      ver_relatorios: true,
      configurar_empresa: true
    };
  }

  async function carregarOperadores() {
    try {
      const empresaId = window.APP_EMPRESA_ID;

      if (!empresaId) return;

      const { data, error } = await sb
        .from("operadores_internos")
        .select("id, empresa_id, nome, usuario, perfil, ativo, criado_em, atualizado_em, ultimo_login_em")
        .eq("empresa_id", empresaId)
        .order("nome");

      if (error) throw error;

      operadoresCache = data || [];

      renderOperadores(operadoresCache);

    } catch (err) {
      console.error("[OPERADORES]", err);
      cfgFeedback("Erro ao carregar operadores.", "erro");
    }
  }

  function renderOperadores(lista) {
    const container = document.getElementById("listaOperadores");

    if (!container) return;

    if (!lista.length) {
      container.innerHTML = `
        <div class="operadores-empty">
          Nenhum operador cadastrado.
        </div>
      `;
      return;
    }

    container.innerHTML = lista.map(op => `
      <div class="operador-card ${op.ativo === false ? "operador-inativo" : ""}">

        <div class="operador-info">
          <div class="operador-nome">
            ${op.nome}
          </div>

          <div class="operador-usuario">
            @${op.usuario}
          </div>

          <span class="operador-perfil">
            ${labelPerfil(op.perfil)}
          </span>
        </div>

        <div class="operador-acoes">

          <button
            class="operador-btn"
            onclick="crvPermissoes.selecionarOperador('${op.id}')"
            title="Permissões"
          >
            <i class="fa-solid fa-shield"></i>
          </button>

          <button
            class="operador-btn"
            onclick="crvPermissoes.visualizarOperador('${op.id}')"
            title="Visualizar operador"
          >
            <i class="fa-solid fa-eye"></i>
          </button>

          <button
            class="operador-btn ${op.ativo === false ? "" : "danger"}"
            onclick="crvPermissoes.alternarAtivoOperador('${op.id}')"
            title="${op.ativo === false ? "Ativar" : "Inativar"}"
          >
            <i class="fa-solid ${op.ativo === false ? "fa-toggle-off" : "fa-toggle-on"}"></i>
          </button>

          <button
            class="operador-btn operador-btn-excluir"
            onclick="crvPermissoes.confirmarExcluirOperador('${op.id}')"
            title="Excluir operador"
          >
            <i class="fa-solid fa-trash"></i>
          </button>

        </div>

      </div>
    `).join("");
  }

  function abrirModalNovo() {
    configurarModalOperadorModoEdicao();

    const modal = document.getElementById("modalOperador");

    if (modal) {
      modal.style.display = "flex";
    }

    document.getElementById("modalOperadorTitulo").textContent = "Novo operador";
    document.getElementById("operadorIdEdicao").value = "";
    document.getElementById("operadorNome").value = "";
    document.getElementById("operadorUsuario").value = "";
    document.getElementById("operadorSenha").value = "";
    document.getElementById("operadorPerfil").value = "operador";
  }

  function fecharModal() {
    const modal = document.getElementById("modalOperador");

    if (modal) {
      modal.style.display = "none";
    }
  }

  async function aplicarPermissoesPadrao(operadorId, perfil) {
    const empresaId = window.APP_EMPRESA_ID;

    if (!empresaId || !operadorId) return;

    const padrao = perfilPadraoPermissoes(perfil);

    const { data: modulos, error: erroModulos } = await sb
      .from("modulos_sistema")
      .select("codigo")
      .eq("ativo", true);

    if (erroModulos) throw erroModulos;

    const payloadModulos = (modulos || []).map(modulo => {
      const liberado = padrao.includes(modulo.codigo);

      return {
        empresa_id: empresaId,
        operador_id: operadorId,
        modulo_codigo: modulo.codigo,
        pode_visualizar: liberado,
        pode_criar: liberado,
        pode_editar: liberado,
        pode_excluir: liberado
      };
    });

    if (payloadModulos.length) {
      const { error } = await sb
        .from("operador_permissoes")
        .upsert(payloadModulos, {
          onConflict: "empresa_id,operador_id,modulo_codigo"
        });

      if (error) throw error;
    }

    const especiais = permissoesEspeciaisPorPerfil(perfil);

    const payloadEspeciais = Object.entries(especiais).map(([permissao, permitido]) => ({
      empresa_id: empresaId,
      operador_id: operadorId,
      permissao,
      permitido
    }));

    const { error: erroEspeciais } = await sb
      .from("operador_permissoes_especiais")
      .upsert(payloadEspeciais, {
        onConflict: "empresa_id,operador_id,permissao"
      });

    if (erroEspeciais) throw erroEspeciais;
  }

  async function salvarOperador() {
    try {
      const empresaId = window.APP_EMPRESA_ID;

      if (!empresaId) {
        cfgFeedback("Empresa não encontrada.", "erro");
        return;
      }

      const id = valorCampo("operadorIdEdicao");
      const nome = valorCampo("operadorNome");
      const usuario = normalizarUsuarioOperador(valorCampo("operadorUsuario"));
      const senha = valorCampo("operadorSenha");
      const perfil = valorCampo("operadorPerfil") || "operador";

      if (!nome) {
        cfgFeedback("Informe o nome do operador.", "erro");
        return;
      }

      if (!usuario) {
        cfgFeedback("Informe o usuário do operador.", "erro");
        return;
      }

      if (!id && !senha) {
        cfgFeedback("Informe uma senha para o operador.", "erro");
        return;
      }

      const { data: operadorId, error } = await sb.rpc(
        "salvar_operador_interno",
        {
          p_id: id || null,
          p_nome: nome,
          p_usuario: usuario,
          p_senha: senha || null,
          p_perfil: perfil
        }
      );

      if (error) throw error;
      if (!operadorId) throw new Error("O operador não foi salvo.");

      await aplicarPermissoesPadrao(operadorId, perfil);

      fecharModal();

      await carregarOperadores();

      if (operadorSelecionado === operadorId) {
        await selecionarOperador(operadorId);
      }

      cfgFeedback(
        id
          ? "Operador atualizado com sucesso."
          : "Operador cadastrado com sucesso.",
        "sucesso"
      );

    } catch (err) {
      console.error("[OPERADORES]", err);

      if (
        String(err?.message || "").includes("duplicate") ||
        String(err?.message || "").includes("unique")
      ) {
        cfgFeedback("Já existe operador com este usuário.", "erro");
        return;
      }

      cfgFeedback("Erro ao salvar operador. Verifique os dados e tente novamente.", "erro");
    }
  }

  function bloquearCamposOperador(bloquear) {
    [
      "operadorNome",
      "operadorUsuario",
      "operadorSenha",
      "operadorPerfil"
    ].forEach(id => {
      const campo = document.getElementById(id);
      if (campo) campo.disabled = bloquear;
    });
  }

  function configurarModalOperadorModoVisualizacao(id) {
    const btnSalvar = document.getElementById("btnSalvarOperador");
    const btnCancelar = document.getElementById("btnCancelarOperador");

    if (btnSalvar) {
      btnSalvar.innerHTML = `
        <i class="fa-solid fa-pen"></i>
        <span>Editar</span>
      `;

      btnSalvar.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        bloquearCamposOperador(false);

        const senha = document.getElementById("operadorSenha");
        if (senha) {
          senha.value = "";
          senha.placeholder = "Digite nova senha ou deixe em branco";
        }

        btnSalvar.innerHTML = `
          <i class="fa-solid fa-floppy-disk"></i>
          <span>Salvar</span>
        `;

      btnSalvar.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        salvarOperador();
      };
      };
    }

    if (btnCancelar) {
      btnCancelar.textContent = "Fechar";
    }
  }

  function configurarModalOperadorModoEdicao() {
    const btnSalvar = document.getElementById("btnSalvarOperador");
    const btnCancelar = document.getElementById("btnCancelarOperador");

    bloquearCamposOperador(false);

      const senha = document.getElementById("operadorSenha");

  if (senha && senha.value === "********") {
    senha.value = "";
    senha.placeholder = "Digite nova senha ou deixe em branco";
  }

    if (btnSalvar) {
      btnSalvar.innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        <span>Salvar</span>
      `;

      btnSalvar.onclick = salvarOperador;
    }

    if (btnCancelar) {
      btnCancelar.textContent = "Cancelar";
    }
  }

  function visualizarOperador(id) {
    const operador = operadoresCache.find(op => String(op.id) === String(id));

    if (!operador) {
      cfgFeedback("Operador não encontrado.", "erro");
      return;
    }

    document.getElementById("modalOperadorTitulo").textContent = "Visualizar operador";
    document.getElementById("operadorIdEdicao").value = operador.id;
    document.getElementById("operadorNome").value = operador.nome || "";
    document.getElementById("operadorUsuario").value = operador.usuario || "";
    document.getElementById("operadorSenha").value = "********";
    document.getElementById("operadorPerfil").value = operador.perfil || "operador";

    bloquearCamposOperador(true);
    configurarModalOperadorModoVisualizacao(id);

    const modal = document.getElementById("modalOperador");

    if (modal) {
      modal.style.display = "flex";
    }
  }

  async function editarOperador(id) {
    const operador = operadoresCache.find(op => String(op.id) === String(id));

    if (!operador) {
      cfgFeedback("Operador não encontrado.", "erro");
      return;
    }

    configurarModalOperadorModoEdicao();

    document.getElementById("modalOperadorTitulo").textContent = "Editar operador";
    document.getElementById("operadorIdEdicao").value = operador.id;
    document.getElementById("operadorNome").value = operador.nome || "";
    document.getElementById("operadorUsuario").value = operador.usuario || "";
    document.getElementById("operadorSenha").value = "********";
    document.getElementById("operadorPerfil").value = operador.perfil || "operador";

    const modal = document.getElementById("modalOperador");

    if (modal) {
      modal.style.display = "flex";
    }
  }

  async function alternarAtivoOperador(id) {
    try {
      const empresaId = window.APP_EMPRESA_ID;
      const operador = operadoresCache.find(op => String(op.id) === String(id));

      if (!empresaId || !operador) return;

      const novoStatus = operador.ativo === false;

      const { error } = await sb
        .from("operadores_internos")
        .update({
          ativo: novoStatus,
          atualizado_em: new Date().toISOString()
        })
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      await carregarOperadores();

      cfgFeedback(
        novoStatus
          ? "Operador ativado com sucesso."
          : "Operador inativado com sucesso.",
        "sucesso"
      );

    } catch (err) {
      console.error("[OPERADORES]", err);
      cfgFeedback("Erro ao alterar status do operador.", "erro");
    }
  }

  function confirmarExcluirOperador(id) {
    const operador = operadoresCache.find(op => String(op.id) === String(id));

    if (!operador) {
      cfgFeedback("Operador não encontrado.", "erro");
      return;
    }

    const operadorAtualId =
      sessionStorage.getItem("CRV_OPERADOR_ID");

    if (operadorAtualId && String(operadorAtualId) === String(id)) {
      cfgFeedback("Não é possível excluir o operador ativo nesta sessão.", "erro");
      return;
    }

    let modal = document.getElementById("modalConfirmarExcluirOperador");

    if (modal) {
      modal.remove();
    }

    modal = document.createElement("div");
    modal.id = "modalConfirmarExcluirOperador";
    modal.className = "setup-modal-overlay active";

    modal.innerHTML = `
      <div class="setup-modal">
        <img src="assets/logo1.png" alt="CRV PDV" class="setup-modal-logo" />

        <h2>Excluir operador?</h2>

        <p>
          O operador <strong>${operador.nome}</strong> será removido do sistema.
          Essa ação não remove vendas antigas, mas o operador não poderá mais ser usado.
        </p>

        <div class="modal-actions-row">
          <button class="btn-secondary" id="btnCancelarExcluirOperador" type="button">
            CANCELAR
          </button>

          <button class="btn-primary btn-confirmar-exclusao-operador" id="btnConfirmarExcluirOperador" type="button">
            EXCLUIR OPERADOR
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btnCancelarExcluirOperador").onclick = () => {
      modal.remove();
    };

    document.getElementById("btnConfirmarExcluirOperador").onclick = async () => {
      await excluirOperador(id);
      modal.remove();
    };
  }

  async function excluirOperador(id) {
    try {
      const empresaId = window.APP_EMPRESA_ID;

      if (!empresaId) {
        cfgFeedback("Empresa não encontrada.", "erro");
        return;
      }

      const operadorAtualId =
        sessionStorage.getItem("CRV_OPERADOR_ID");

      if (operadorAtualId && String(operadorAtualId) === String(id)) {
        cfgFeedback("Não é possível excluir o operador ativo nesta sessão.", "erro");
        return;
      }

      const { error } = await sb
        .from("operadores_internos")
        .delete()
        .eq("id", id)
        .eq("empresa_id", empresaId);

      if (error) throw error;

      if (operadorSelecionado === id) {
        operadorSelecionado = null;

        const modalPermissoes =
          document.getElementById("modalPermissoesOperador");

        if (modalPermissoes) {
          modalPermissoes.style.display = "none";
        }
      }

      await carregarOperadores();

      cfgFeedback("Operador excluído com sucesso.", "sucesso");

    } catch (err) {
      console.error("[OPERADORES][EXCLUIR]", err);
      cfgFeedback("Erro ao excluir operador.", "erro");
    }
  }

  async function selecionarOperador(id) {
    operadorSelecionado = id;

    const modalPermissoes =
  document.getElementById("modalPermissoesOperador");

if (modalPermissoes) {
  modalPermissoes.style.display = "flex";
}

    const operador = operadoresCache.find(op => String(op.id) === String(id));
    const texto = document.getElementById("permissoesOperadorTexto");
    const box = document.getElementById("boxPermissoesOperador");

    if (!box) return;

    if (texto && operador) {
      texto.textContent = `Configurando permissões de ${operador.nome}.`;
    }

    box.innerHTML = `
      <div class="operadores-empty">
        Carregando permissões...
      </div>
    `;

    try {
      const empresaId = window.APP_EMPRESA_ID;

      const { data: permissoes, error } = await sb
        .from("operador_permissoes")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("operador_id", id)
        .order("modulo_codigo");

      if (error) throw error;

      const { data: especiais, error: erroEspeciais } = await sb
        .from("operador_permissoes_especiais")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("operador_id", id)
        .order("permissao");

      if (erroEspeciais) throw erroEspeciais;

      renderPermissoes(permissoes || [], especiais || []);

    } catch (err) {
      console.error("[PERMISSÕES]", err);

      box.innerHTML = `
        <div class="operadores-empty">
          Erro ao carregar permissões.
        </div>
      `;

      cfgFeedback("Erro ao carregar permissões.", "erro");
    }
  }

function renderPermissoes(permissoes) {
  const box = document.getElementById("boxPermissoesOperador");

  if (!box) return;

  if (!permissoes.length) {
    box.innerHTML = `
      <div class="operadores-empty">
        Este operador ainda não possui permissões geradas.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="permissoes-grupo permissoes-grupo-simples">
      <h3>Telas liberadas</h3>

      ${permissoes.map(p => `
        <label class="permissao-tela-card">
          <div>
            <strong>${labelModulo(p.modulo_codigo)}</strong>
            <span>Permitir acesso à tela</span>
          </div>

          <input
            type="checkbox"
            data-permissao-id="${p.id}"
            data-modulo="${p.modulo_codigo}"
            ${p.pode_visualizar ? "checked" : ""}
          >
        </label>
      `).join("")}
    </div>

    <button
      class="btn-secondary btn-salvar-permissoes"
      type="button"
      onclick="crvPermissoes.salvarPermissoes()"
    >
      <i class="fa-solid fa-floppy-disk"></i>
      <span>Salvar telas liberadas</span>
    </button>
  `;
}

  async function salvarPermissoes() {
    try {
      const checksModulos = document.querySelectorAll("[data-permissao-id]");

      for (const input of checksModulos) {
        const liberado = input.checked === true;

        const { error } = await sb
          .from("operador_permissoes")
          .update({
            pode_visualizar: liberado,
            pode_criar: liberado,
            pode_editar: liberado,
            pode_excluir: liberado,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", input.dataset.permissaoId);

        if (error) throw error;
      }

      const modalPermissoes = document.getElementById("modalPermissoesOperador");

      if (modalPermissoes) {
        modalPermissoes.style.display = "none";
      }

      cfgFeedback("Telas liberadas salvas com sucesso.", "sucesso");

      const operadorAtualId = sessionStorage.getItem("CRV_OPERADOR_ID");

      if (
        operadorAtualId &&
        String(operadorAtualId) === String(operadorSelecionado)
      ) {
        if (typeof crvCarregarPermissoesOperadorAtual === "function") {
          await crvCarregarPermissoesOperadorAtual();
        }

        if (typeof crvAplicarPermissoesInterface === "function") {
          crvAplicarPermissoesInterface();
        }
      }

    } catch (err) {
      console.error("[PERMISSÕES]", err);
      cfgFeedback("Erro ao salvar telas liberadas.", "erro");
    }
  }

  function init() {
    const btnNovo = document.getElementById("btnNovoOperador");
    const btnFechar = document.getElementById("btnFecharOperador");
    const btnCancelar = document.getElementById("btnCancelarOperador");
    const btnSalvar = document.getElementById("btnSalvarOperador");
    const btnFecharPermissoes =
  document.getElementById("btnFecharPermissoesOperador");

    if (btnNovo) {
      btnNovo.addEventListener("click", abrirModalNovo);
    }

    if (btnFechar) {
      btnFechar.addEventListener("click", fecharModal);
    }

    if (btnCancelar) {
      btnCancelar.addEventListener("click", fecharModal);
    }

    if (btnFecharPermissoes) {
  btnFecharPermissoes.addEventListener("click", () => {

    const modal =
      document.getElementById("modalPermissoesOperador");

    if (modal) {
      modal.style.display = "none";
    }
  });
}
  }

  return {
    init,
    carregarOperadores,
    selecionarOperador,
    visualizarOperador,
    editarOperador,
    alternarAtivoOperador,
    confirmarExcluirOperador,
    excluirOperador,
    salvarOperador,
    salvarPermissoes
  };

})();

document.addEventListener("DOMContentLoaded", () => {
  window.crvPermissoes.init();
});

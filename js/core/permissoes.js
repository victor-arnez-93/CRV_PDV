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

  function perfilPadraoPermissoes(perfil) {
    const permissoes = {
      admin: {
        modulos: [
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
        criar: true,
        editar: true,
        excluir: true
      },

      gerente: {
        modulos: [
          "dashboard",
          "caixa",
          "comandas",
          "agenda",
          "vendas",
          "produtos",
          "clientes",
          "relatorios"
        ],
        criar: true,
        editar: true,
        excluir: false
      },

      operador: {
        modulos: [
          "dashboard",
          "caixa",
          "comandas",
          "agenda",
          "vendas"
        ],
        criar: true,
        editar: true,
        excluir: false
      },

      caixa: {
        modulos: [
          "dashboard",
          "caixa",
          "comandas",
          "vendas"
        ],
        criar: true,
        editar: true,
        excluir: false
      },

      agenda: {
        modulos: [
          "dashboard",
          "agenda",
          "clientes"
        ],
        criar: true,
        editar: true,
        excluir: false
      },

      relatorios: {
        modulos: [
          "dashboard",
          "vendas",
          "relatorios"
        ],
        criar: false,
        editar: false,
        excluir: false
      }
    };

    return permissoes[perfil] || permissoes.operador;
  }

  function permissoesEspeciaisPorPerfil(perfil) {
    const base = {
      venda_manual: false,
      desconto: false,
      cancelar_venda: false,
      abrir_caixa: false,
      fechar_caixa: false,
      editar_jogador: false,
      remover_jogador: false,
      enviar_jogador_comanda: false,
      alterar_preco_manual: false,
      ver_relatorios: false,
      configurar_empresa: false
    };

    if (perfil === "admin") {
      Object.keys(base).forEach(chave => {
        base[chave] = true;
      });

      return base;
    }

    if (perfil === "gerente") {
      return {
        ...base,
        venda_manual: true,
        desconto: true,
        abrir_caixa: true,
        fechar_caixa: true,
        editar_jogador: true,
        remover_jogador: true,
        enviar_jogador_comanda: true,
        ver_relatorios: true
      };
    }

    if (perfil === "caixa") {
      return {
        ...base,
        venda_manual: true,
        desconto: true,
        abrir_caixa: true,
        fechar_caixa: true,
        enviar_jogador_comanda: true
      };
    }

    if (perfil === "agenda") {
      return {
        ...base,
        editar_jogador: true,
        remover_jogador: true,
        enviar_jogador_comanda: true
      };
    }

    if (perfil === "relatorios") {
      return {
        ...base,
        ver_relatorios: true
      };
    }

    return {
      ...base,
      venda_manual: true,
      enviar_jogador_comanda: true
    };
  }

  async function carregarOperadores() {
    try {
      const empresaId = window.APP_EMPRESA_ID;

      if (!empresaId) return;

      const { data, error } = await sb
        .from("operadores_internos")
        .select("*")
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
            ${op.perfil}
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
            onclick="crvPermissoes.editarOperador('${op.id}')"
            title="Editar"
          >
            <i class="fa-solid fa-pen"></i>
          </button>

          <button
            class="operador-btn ${op.ativo === false ? "" : "danger"}"
            onclick="crvPermissoes.alternarAtivoOperador('${op.id}')"
            title="${op.ativo === false ? "Ativar" : "Inativar"}"
          >
            <i class="fa-solid ${op.ativo === false ? "fa-toggle-off" : "fa-toggle-on"}"></i>
          </button>

        </div>

      </div>
    `).join("");
  }

  function abrirModalNovo() {
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
      const liberado = padrao.modulos.includes(modulo.codigo);

      return {
        empresa_id: empresaId,
        operador_id: operadorId,
        modulo_codigo: modulo.codigo,
        pode_visualizar: liberado,
        pode_criar: liberado ? padrao.criar : false,
        pode_editar: liberado ? padrao.editar : false,
        pode_excluir: liberado ? padrao.excluir : false
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

      const payload = {
        empresa_id: empresaId,
        nome,
        usuario,
        perfil,
        ativo: true,
        atualizado_em: new Date().toISOString()
      };

      if (senha) {
        payload.senha = senha;
      }

      let operadorId = id;

      if (id) {
        const { error } = await sb
          .from("operadores_internos")
          .update(payload)
          .eq("id", id)
          .eq("empresa_id", empresaId);

        if (error) throw error;

      } else {
        const { data, error } = await sb
          .from("operadores_internos")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;

        operadorId = data.id;
      }

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

  async function editarOperador(id) {
    const operador = operadoresCache.find(op => String(op.id) === String(id));

    if (!operador) {
      cfgFeedback("Operador não encontrado.", "erro");
      return;
    }

    document.getElementById("modalOperadorTitulo").textContent = "Editar operador";
    document.getElementById("operadorIdEdicao").value = operador.id;
    document.getElementById("operadorNome").value = operador.nome || "";
    document.getElementById("operadorUsuario").value = operador.usuario || "";
    document.getElementById("operadorSenha").value = "";
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

  async function selecionarOperador(id) {
    operadorSelecionado = id;

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

function renderPermissoes(permissoes, especiais) {
  const box = document.getElementById("boxPermissoesOperador");

  if (!box) return;

  if (!permissoes.length && !especiais.length) {
    box.innerHTML = `
      <div class="operadores-empty">
        Este operador ainda não possui permissões geradas.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="permissoes-grupo">
      <h3>Módulos</h3>

      ${permissoes.map(p => `
        <div class="permissao-card">

          <div class="permissao-card-title">
            ${labelModulo(p.modulo_codigo)}
          </div>

          <div class="permissao-opcoes">

            <label>
              <input
                type="checkbox"
                data-permissao-id="${p.id}"
                data-campo="pode_visualizar"
                ${p.pode_visualizar ? "checked" : ""}
              >
              Ver
            </label>

            <label>
              <input
                type="checkbox"
                data-permissao-id="${p.id}"
                data-campo="pode_criar"
                ${p.pode_criar ? "checked" : ""}
              >
              Criar
            </label>

            <label>
              <input
                type="checkbox"
                data-permissao-id="${p.id}"
                data-campo="pode_editar"
                ${p.pode_editar ? "checked" : ""}
              >
              Editar
            </label>

            <label>
              <input
                type="checkbox"
                data-permissao-id="${p.id}"
                data-campo="pode_excluir"
                ${p.pode_excluir ? "checked" : ""}
              >
              Excluir
            </label>

          </div>

        </div>
      `).join("")}
    </div>

    <div class="permissoes-grupo">
      <h3>Ações especiais</h3>

      ${especiais.map(p => `
        <label class="permissao-especial">
          <span>${labelPermissaoEspecial(p.permissao)}</span>

          <input
            type="checkbox"
            data-especial-id="${p.id}"
            ${p.permitido ? "checked" : ""}
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
      <span>Salvar permissões</span>
    </button>
  `;
}

  async function salvarPermissoes() {
    try {
      const checksModulos = document.querySelectorAll("[data-permissao-id]");
      const checksEspeciais = document.querySelectorAll("[data-especial-id]");

      const agrupadas = {};

      checksModulos.forEach(input => {
        const id = input.dataset.permissaoId;
        const campo = input.dataset.campo;

        if (!agrupadas[id]) {
          agrupadas[id] = { id };
        }

        agrupadas[id][campo] = input.checked;
      });

      for (const permissao of Object.values(agrupadas)) {
        const { id, ...payload } = permissao;

        const { error } = await sb
          .from("operador_permissoes")
          .update({
            ...payload,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", id);

        if (error) throw error;
      }

      for (const input of checksEspeciais) {
        const { error } = await sb
          .from("operador_permissoes_especiais")
          .update({
            permitido: input.checked,
            atualizado_em: new Date().toISOString()
          })
          .eq("id", input.dataset.especialId);

        if (error) throw error;
      }

      cfgFeedback("Permissões salvas com sucesso.", "sucesso");

    } catch (err) {
      console.error("[PERMISSÕES]", err);
      cfgFeedback("Erro ao salvar permissões.", "erro");
    }
  }

  function init() {
    const btnNovo = document.getElementById("btnNovoOperador");
    const btnFechar = document.getElementById("btnFecharOperador");
    const btnCancelar = document.getElementById("btnCancelarOperador");
    const btnSalvar = document.getElementById("btnSalvarOperador");

    if (btnNovo) {
      btnNovo.addEventListener("click", abrirModalNovo);
    }

    if (btnFechar) {
      btnFechar.addEventListener("click", fecharModal);
    }

    if (btnCancelar) {
      btnCancelar.addEventListener("click", fecharModal);
    }

    if (btnSalvar) {
      btnSalvar.addEventListener("click", salvarOperador);
    }
  }

  return {
    init,
    carregarOperadores,
    selecionarOperador,
    editarOperador,
    alternarAtivoOperador,
    salvarOperador,
    salvarPermissoes
  };

})();

document.addEventListener("DOMContentLoaded", () => {
  window.crvPermissoes.init();
});
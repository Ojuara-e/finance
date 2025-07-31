// App principal para gerenciamento financeiro offline.
// Todos os dados são salvos no localStorage.

(function () {
  // Dados carregados do localStorage
  // Renamed "expenses" to "transactions" to reflect that the list
  // contains tanto entradas quanto saídas.
  let transactions = [];
  let members = [];
  // Se estiver em modo de edição, armazenamos o id da transação a editar
  let editTransactionId = null;

  // =============================
  // Módulos adicionais: Agenda e Despesas Fixas
  //
  // Para armazenar lembretes de contas a pagar/receber e despesas fixas
  // rateadas entre membros, usamos arrays específicos persistidos no
  // localStorage para cada usuário.
  // =============================

  // Lista de lembretes {id, description, date, value, type: 'pay'|'receive'}
  let reminders = [];
  // Lista de despesas fixas {id, name, total, contributions: [{memberId, salary, amount}]}
  let fixedExpenses = [];

  const appEl = document.getElementById('app');

  // ================================================================
  //  Gerenciamento de usuários e autenticação
  //
  // Para oferecer o app para várias famílias, implementamos uma
  // camada de autenticação simples. Cada família se registra com um
  // e‑mail e senha e vê apenas seus próprios dados. A lista de
  // e‑mails permitidos para cadastro fica no localStorage na chave
  // "allowedEmails". Caso a lista não exista, é inicializada com
  // os e‑mails definidos pelo administrador abaixo. Somente esses
  // e‑mails podem criar conta.
  // ================================================================

  // Lista de usuários registrados {email, password}
  let users = [];
  // Lista de e‑mails permitidos a se registrar
  let allowedEmails = [];
  // Usuário logado atualmente
  let currentUser = null;

  // Carrega usuários do localStorage
  function loadUsers() {
    try {
      const str = localStorage.getItem('users');
      users = str ? JSON.parse(str) : [];
    } catch (e) {
      users = [];
    }
  }

  // Salva usuários no localStorage
  function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
  }

  // Carrega lista de e‑mails permitidos; se não houver, inicializa com
  // e‑mails fornecidos pelo administrador.
  function loadAllowedEmails() {
    // Sempre inicializa com a lista de e‑mails autorizados. Caso deseje
    // alterar essa lista, modifique o array abaixo e os e‑mails
    // persistirão no localStorage.
    allowedEmails = [
      'elias@javeh.com',
      'gabriela@javeh.com',
      'erika@javeh.com',
      'sara@javeh.com',
      'erik@javeh.com',
      'giovani@javeh.com',
    ];
    saveAllowedEmails();
  }

  // Salva lista de e‑mails permitidos
  function saveAllowedEmails() {
    localStorage.setItem('allowedEmails', JSON.stringify(allowedEmails));
  }

  // Salva usuário logado atual
  function saveCurrentUser(email) {
    currentUser = email;
    if (email) localStorage.setItem('currentUser', email);
    else localStorage.removeItem('currentUser');
  }

  // Carrega usuário logado atual
  function loadCurrentUser() {
    return localStorage.getItem('currentUser');
  }

  // Gera chave de armazenamento para transações de acordo com usuário
  function getTransactionsKey() {
    return currentUser ? `transactions_${currentUser}` : 'transactions';
  }

  // Gera chave de armazenamento para membros de acordo com usuário
  function getMembersKey() {
    return currentUser ? `members_${currentUser}` : 'members';
  }

  // Gera chave de armazenamento para lembretes de agenda
  function getRemindersKey() {
    return currentUser ? `reminders_${currentUser}` : 'reminders';
  }

  // Gera chave de armazenamento para despesas fixas
  function getFixedKey() {
    return currentUser ? `fixed_${currentUser}` : 'fixed';
  }

  // Carrega lembretes do localStorage
  function loadReminders() {
    try {
      const str = localStorage.getItem(getRemindersKey());
      reminders = str ? JSON.parse(str) : [];
    } catch (e) {
      reminders = [];
    }
  }

  // Salva lembretes no localStorage
  function saveReminders() {
    localStorage.setItem(getRemindersKey(), JSON.stringify(reminders));
  }

  // Carrega despesas fixas do localStorage
  function loadFixedExpenses() {
    try {
      const str = localStorage.getItem(getFixedKey());
      fixedExpenses = str ? JSON.parse(str) : [];
    } catch (e) {
      fixedExpenses = [];
    }
  }

  // Salva despesas fixas no localStorage
  function saveFixedExpenses() {
    localStorage.setItem(getFixedKey(), JSON.stringify(fixedExpenses));
  }

  // Carrega dados do localStorage
  function loadData() {
    // Carrega dados isolados por usuário
    try {
      const transStr = localStorage.getItem(getTransactionsKey());
      transactions = transStr ? JSON.parse(transStr) : [];
    } catch (e) {
      transactions = [];
    }
    try {
      const memStr = localStorage.getItem(getMembersKey());
      members = memStr ? JSON.parse(memStr) : [];
    } catch (e) {
      members = [];
    }
    // Garante membro padrão
    if (!members || members.length === 0) {
      members = [
        {
          id: 'all',
          name: 'Todos',
          details: 'Gastos gerais',
        },
      ];
      saveMembers();
    }
  }

  function saveTransactions() {
    localStorage.setItem(getTransactionsKey(), JSON.stringify(transactions));
  }

  function saveMembers() {
    localStorage.setItem(getMembersKey(), JSON.stringify(members));
  }

  // Formata data no padrão dd/mm/yyyy
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Formata valor monetário em BRL
  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function getMemberById(id) {
    return members.find((m) => m.id === id);
  }

  // Remove classe ativa dos links de navegação
  function clearActiveNav() {
    document.querySelectorAll('.nav-link').forEach((btn) => btn.classList.remove('active'));
  }

  // Troca de página
  function switchPage(page, id) {
    // Se um id for passado, prepara edição de transação
    if (id) {
      editTransactionId = id;
    } else {
      editTransactionId = null;
    }
    clearActiveNav();
    const navBtn = document.getElementById(`nav-${page}`);
    if (navBtn) navBtn.classList.add('active');
    if (page === 'dashboard') renderDashboard();
    else if (page === 'transactions') renderTransactions();
    else if (page === 'add') renderAddEntry();
    else if (page === 'profile') renderProfile();
    else if (page === 'agenda') renderAgenda();
    else if (page === 'fixed') renderFixedExpenses();
  }

  // Cria HTML para o dashboard
  function renderDashboard() {
    loadData();
    // Filtrar por membro selecionado
    // Padrão: 'all'
    let selectedMemberId = 'all';
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Resumo Financeiro';
    container.appendChild(header);

    // Seleção de membro para filtrar
    const memberFilterGroup = document.createElement('div');
    memberFilterGroup.className = 'form-group';
    const memberLabel = document.createElement('label');
    memberLabel.textContent = 'Filtrar por membro';
    const memberSelect = document.createElement('select');
    members.forEach((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.name;
      memberSelect.appendChild(option);
    });
    memberSelect.value = selectedMemberId;
    memberFilterGroup.appendChild(memberLabel);
    memberFilterGroup.appendChild(memberSelect);
    container.appendChild(memberFilterGroup);

    // Elementos para exibir totais
    const summaryRow = document.createElement('div');
    summaryRow.className = 'flex-row';

    const incomeDiv = document.createElement('div');
    incomeDiv.className = 'card';
    const incomeTitle = document.createElement('h3');
    incomeTitle.textContent = 'Entradas';
    const incomeVal = document.createElement('p');
    incomeVal.id = 'incomeVal';
    incomeVal.style.fontSize = '1.4rem';
    incomeVal.style.fontWeight = '600';
    incomeVal.style.color = '#10B981';
    incomeDiv.appendChild(incomeTitle);
    incomeDiv.appendChild(incomeVal);

    const expenseDiv = document.createElement('div');
    expenseDiv.className = 'card';
    const expenseTitle = document.createElement('h3');
    expenseTitle.textContent = 'Saídas';
    const expenseVal = document.createElement('p');
    expenseVal.id = 'expenseVal';
    expenseVal.style.fontSize = '1.4rem';
    expenseVal.style.fontWeight = '600';
    expenseVal.style.color = '#EF4444';
    expenseDiv.appendChild(expenseTitle);
    expenseDiv.appendChild(expenseVal);

    const balanceDiv = document.createElement('div');
    balanceDiv.className = 'card';
    const balanceTitle = document.createElement('h3');
    balanceTitle.textContent = 'Saldo Atual';
    const balanceVal = document.createElement('p');
    balanceVal.id = 'balanceVal';
    balanceVal.style.fontSize = '1.4rem';
    balanceVal.style.fontWeight = '600';
    balanceVal.style.color = '#374151';
    balanceDiv.appendChild(balanceTitle);
    balanceDiv.appendChild(balanceVal);

    summaryRow.appendChild(incomeDiv);
    summaryRow.appendChild(expenseDiv);
    summaryRow.appendChild(balanceDiv);
    container.appendChild(summaryRow);

    // Charts container
    const chartsRow = document.createElement('div');
    chartsRow.className = 'flex-row';
    chartsRow.style.marginTop = '1rem';

    // Pie chart
    const pieContainer = document.createElement('div');
    pieContainer.className = 'card';
    const pieTitle = document.createElement('h3');
    pieTitle.textContent = 'Distribuição de Gastos por Categoria';
    const pieCanvas = document.createElement('canvas');
    pieCanvas.id = 'pieChart';
    pieCanvas.width = 400;
    pieCanvas.height = 300;
    pieContainer.appendChild(pieTitle);
    pieContainer.appendChild(pieCanvas);
    chartsRow.appendChild(pieContainer);

    // Bar chart
    const barContainer = document.createElement('div');
    barContainer.className = 'card';
    const barTitle = document.createElement('h3');
    barTitle.textContent = 'Receitas x Despesas (últimos meses)';
    const barCanvas = document.createElement('canvas');
    barCanvas.id = 'barChart';
    barCanvas.width = 400;
    barCanvas.height = 300;
    barContainer.appendChild(barTitle);
    barContainer.appendChild(barCanvas);
    chartsRow.appendChild(barContainer);

    container.appendChild(chartsRow);

    // Previsão
    const forecastCard = document.createElement('div');
    forecastCard.className = 'card';
    const forecastTitle = document.createElement('h3');
    forecastTitle.textContent = 'Previsão de Saldo Próximo Mês';
    const forecastVal = document.createElement('p');
    forecastVal.id = 'forecastVal';
    forecastVal.style.fontSize = '1.3rem';
    forecastVal.style.fontWeight = '600';
    forecastVal.style.color = '#6366F1';
    forecastCard.appendChild(forecastTitle);
    forecastCard.appendChild(forecastVal);
    container.appendChild(forecastCard);

    appEl.appendChild(container);

    // Calcula e atualiza valores e gráficos
    function updateSummary() {
      selectedMemberId = memberSelect.value;
      // Filtra despesas de acordo com o membro
      const filtered = selectedMemberId === 'all'
        ? transactions
        : transactions.filter((e) => e.memberId === selectedMemberId);
      const totalIncome = filtered
        .filter((e) => e.type === 'income')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const totalExpense = filtered
        .filter((e) => e.type === 'expense')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      incomeVal.textContent = formatCurrency(totalIncome);
      expenseVal.textContent = formatCurrency(totalExpense);
      const balance = totalIncome - totalExpense;
      balanceVal.textContent = formatCurrency(balance);

      // Dados para pie chart (apenas despesas)
      const byCategory = {};
      filtered
        .filter((e) => e.type === 'expense')
        .forEach((e) => {
          byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
        });
      drawPieChart('pieChart', byCategory);

      // Dados para bar chart (últimos 6 meses)
      const monthly = {};
      filtered.forEach((e) => {
        const d = new Date(e.date);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
          monthly[key][e.type] += Number(e.amount);
        }
      });
      // Ordena chaves e pega as últimas 6
      const monthKeys = Object.keys(monthly).sort();
      const last6 = monthKeys.slice(-6);
      const labels = last6.map((key) => {
        const [y, m] = key.split('-');
        return `${m}/${y}`;
      });
      const incomesArr = last6.map((k) => monthly[k].income);
      const expensesArr = last6.map((k) => monthly[k].expense);
      drawBarChart('barChart', labels, incomesArr, expensesArr);

      // Previsão: média de saldo mensal (in/out) nos últimos 6 meses
      const netValues = last6.map((k) => monthly[k].income - monthly[k].expense);
      const avgNet = netValues.length > 0 ? netValues.reduce((a, b) => a + b, 0) / netValues.length : 0;
      const forecast = balance + avgNet;
      forecastVal.textContent = formatCurrency(forecast);
    }

    memberSelect.addEventListener('change', updateSummary);
    updateSummary();
  }

  // Renderiza a página de transações
  function renderTransactions() {
    loadData();
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Lista de Transações';
    container.appendChild(header);

    // Filtro por membro
    const filterRow = document.createElement('div');
    filterRow.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = 'Filtrar por membro';
    const select = document.createElement('select');
    members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    select.value = 'all';
    filterRow.appendChild(label);
    filterRow.appendChild(select);
    container.appendChild(filterRow);

    // Ações de exportação/importação
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '1rem';
    actionRow.style.marginBottom = '1rem';
    // Botão exportar
    const exportBtn = document.createElement('button');
    exportBtn.className = 'secondary';
    exportBtn.textContent = 'Exportar JSON';
    exportBtn.addEventListener('click', function () {
      const data = {
        transactions: transactions,
        members: members,
      };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finance_data.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    // Campo importar
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    importInput.className = 'secondary';
    importInput.addEventListener('change', function (ev) {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = JSON.parse(e.target.result);
          if (data.transactions) transactions = data.transactions;
          if (data.members) members = data.members;
          saveMembers();
          saveTransactions();
          refreshTable();
          alert('Dados importados com sucesso!');
        } catch (err) {
          console.error(err);
          alert('Erro ao importar dados.');
        }
      };
      reader.readAsText(file);
    });
    actionRow.appendChild(exportBtn);
    actionRow.appendChild(importInput);
    container.appendChild(actionRow);

    // Tabela
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Data', 'Descrição', 'Categoria', 'Tipo', 'Membro', 'Valor', 'Anexo', 'Ações'].forEach((title) => {
      const th = document.createElement('th');
      th.textContent = title;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    container.appendChild(table);
    appEl.appendChild(container);

    function refreshTable() {
      const memberId = select.value;
      tbody.innerHTML = '';
      const filtered = memberId === 'all' ? transactions : transactions.filter((e) => e.memberId === memberId);
      // Ordena por data descendente
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      filtered.forEach((e) => {
        const row = document.createElement('tr');
        // Data
        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(e.date);
        row.appendChild(dateCell);
        // Descrição
        const descCell = document.createElement('td');
        descCell.textContent = e.description || '';
        row.appendChild(descCell);
        // Categoria
        const categoryCell = document.createElement('td');
        categoryCell.textContent = e.category || '';
        row.appendChild(categoryCell);
        // Tipo
        const typeCell = document.createElement('td');
        typeCell.textContent = e.type === 'income' ? 'Entrada' : 'Saída';
        row.appendChild(typeCell);
        // Membro
        const memberCell = document.createElement('td');
        const m = getMemberById(e.memberId) || { name: 'Não definido' };
        memberCell.textContent = m.name;
        row.appendChild(memberCell);
        // Valor
        const amountCell = document.createElement('td');
        amountCell.textContent = formatCurrency(Number(e.amount));
        amountCell.style.color = e.type === 'income' ? '#10B981' : '#EF4444';
        row.appendChild(amountCell);
        // Anexo
        const attachCell = document.createElement('td');
        if (e.attachment && e.attachment.data) {
          const link = document.createElement('a');
          link.href = e.attachment.data;
          link.download = e.attachment.name;
          link.textContent = 'Ver';
          link.target = '_blank';
          attachCell.appendChild(link);
        } else {
          attachCell.textContent = '-';
        }
        row.appendChild(attachCell);
        // Ações
        const actionCell = document.createElement('td');
        // Editar
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary';
        editBtn.textContent = 'Editar';
        editBtn.addEventListener('click', function () {
          switchPage('add', e.id);
        });
        // Excluir
        const delBtn = document.createElement('button');
        delBtn.className = 'secondary';
        delBtn.textContent = 'Excluir';
        delBtn.style.marginLeft = '0.5rem';
        delBtn.addEventListener('click', function () {
          if (!confirm('Deseja remover esta transação?')) return;
          transactions = transactions.filter((t) => t.id !== e.id);
          saveTransactions();
          refreshTable();
        });
        actionCell.appendChild(editBtn);
        actionCell.appendChild(delBtn);
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });
    }

    select.addEventListener('change', refreshTable);
    refreshTable();
  }

  // Renderiza a página para adicionar entrada ou despesa
  function renderAddEntry() {
    loadData();
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Adicionar Lançamento';
    container.appendChild(header);

    const form = document.createElement('form');
    form.id = 'entryForm';
    form.className = 'flex-col';

    // Tipo (entrada/saída)
    const typeGroup = document.createElement('div');
    typeGroup.className = 'form-group';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Tipo';
    const typeSelect = document.createElement('select');
    [
      { value: 'income', label: 'Entrada' },
      { value: 'expense', label: 'Saída' },
    ].forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      typeSelect.appendChild(option);
    });
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    form.appendChild(typeGroup);

    // Membro
    const memberGroup = document.createElement('div');
    memberGroup.className = 'form-group';
    const memberLabel = document.createElement('label');
    memberLabel.textContent = 'Membro';
    const memberSelect = document.createElement('select');
    members.forEach((m) => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.name;
      memberSelect.appendChild(option);
    });
    memberGroup.appendChild(memberLabel);
    memberGroup.appendChild(memberSelect);
    form.appendChild(memberGroup);

    // Categoria
    const catGroup = document.createElement('div');
    catGroup.className = 'form-group';
    const catLabel = document.createElement('label');
    catLabel.textContent = 'Categoria';
    const catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.required = true;
    catGroup.appendChild(catLabel);
    catGroup.appendChild(catInput);
    form.appendChild(catGroup);

    // Descrição
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descrição';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.required = true;
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descInput);
    form.appendChild(descGroup);

    // Valor
    const valGroup = document.createElement('div');
    valGroup.className = 'form-group';
    const valLabel = document.createElement('label');
    valLabel.textContent = 'Valor';
    const valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.step = '0.01';
    valInput.min = '0';
    valInput.required = true;
    valGroup.appendChild(valLabel);
    valGroup.appendChild(valInput);
    form.appendChild(valGroup);

    // Data
    const dateGroup = document.createElement('div');
    dateGroup.className = 'form-group';
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Data';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.required = true;
    // valor padrão: hoje
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateGroup.appendChild(dateLabel);
    dateGroup.appendChild(dateInput);
    form.appendChild(dateGroup);

    // Anexo
    const attachGroup = document.createElement('div');
    attachGroup.className = 'form-group';
    const attachLabel = document.createElement('label');
    attachLabel.textContent = 'Anexo (imagem ou PDF)';
    const attachInput = document.createElement('input');
    attachInput.type = 'file';
    attachInput.accept = 'image/*,application/pdf';
    attachGroup.appendChild(attachLabel);
    attachGroup.appendChild(attachInput);
    form.appendChild(attachGroup);

    // Botões
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '1rem';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Salvar';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'reset';
    resetBtn.className = 'secondary';
    resetBtn.textContent = 'Limpar';
    btnRow.appendChild(submitBtn);
    btnRow.appendChild(resetBtn);
    form.appendChild(btnRow);

    container.appendChild(form);
    appEl.appendChild(container);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      // Validações básicas
      if (!descInput.value.trim() || !catInput.value.trim() || !valInput.value || valInput.value <= 0) {
        alert('Preencha todos os campos corretamente.');
        return;
      }
      // Lê arquivo anexado
      const file = attachInput.files[0];
      // cria ou atualiza entrada
      const entryData = {
        id: editTransactionId ? editTransactionId : String(Date.now()),
        type: typeSelect.value,
        memberId: memberSelect.value,
        category: catInput.value.trim(),
        description: descInput.value.trim(),
        amount: parseFloat(valInput.value),
        date: dateInput.value,
        attachment: null,
      };
      function finalize() {
        if (editTransactionId) {
          // atualizar transação existente
          const idx = transactions.findIndex((t) => t.id === editTransactionId);
          if (idx !== -1) {
            transactions[idx] = entryData;
          } else {
            transactions.push(entryData);
          }
          alert('Lançamento atualizado com sucesso!');
        } else {
          transactions.push(entryData);
          alert('Lançamento adicionado com sucesso!');
        }
        saveTransactions();
        // limpar
        form.reset();
        dateInput.value = new Date().toISOString().split('T')[0];
        editTransactionId = null;
      }
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          entryData.attachment = {
            name: file.name,
            data: e.target.result,
          };
          finalize();
        };
        reader.readAsDataURL(file);
      } else {
        finalize();
      }
    });

    // Se estivermos em modo de edição, pré-preenche formulário
    if (editTransactionId) {
      const tr = transactions.find((t) => t.id === editTransactionId);
      if (tr) {
        typeSelect.value = tr.type;
        memberSelect.value = tr.memberId;
        catInput.value = tr.category;
        descInput.value = tr.description || '';
        valInput.value = tr.amount;
        dateInput.value = tr.date;
        // observação: anexos não são recarregados por questões de segurança
      }
    }
  }

  // Renderiza a página de perfil
  function renderProfile() {
    loadData();
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Membros da Família';
    container.appendChild(header);

    // Lista de membros
    const listDiv = document.createElement('div');
    listDiv.id = 'memberList';
    members.forEach((member) => {
      if (member.id === 'all') return; // não mostrar o membro padrão
      const card = createMemberCard(member);
      listDiv.appendChild(card);
    });
    container.appendChild(listDiv);

    // Formulário para adicionar membro
    const formTitle = document.createElement('h3');
    formTitle.textContent = 'Adicionar Membro';
    container.appendChild(formTitle);
    const form = document.createElement('form');
    form.className = 'flex-col';
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nome';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);
    const detailGroup = document.createElement('div');
    detailGroup.className = 'form-group';
    const detailLabel = document.createElement('label');
    detailLabel.textContent = 'Detalhes (opcional)';
    const detailInput = document.createElement('input');
    detailInput.type = 'text';
    detailGroup.appendChild(detailLabel);
    detailGroup.appendChild(detailInput);
    form.appendChild(detailGroup);
    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'primary';
    addBtn.textContent = 'Adicionar';
    form.appendChild(addBtn);
    container.appendChild(form);
    appEl.appendChild(container);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      const newMember = {
        id: String(Date.now()),
        name: name,
        details: detailInput.value.trim(),
      };
      members.push(newMember);
      saveMembers();
      // Atualiza lista
      const card = createMemberCard(newMember);
      listDiv.appendChild(card);
      // Limpa campos
      form.reset();
    });
  }

  // Cria cartão para membro
  function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    // Avatar simples com iniciais
    const avatar = document.createElement('div');
    avatar.className = 'member-avatar';
    avatar.textContent = (member.name[0] || '').toUpperCase();
    card.appendChild(avatar);
    const info = document.createElement('div');
    info.className = 'member-info';
    const nameEl = document.createElement('p');
    nameEl.style.margin = '0';
    nameEl.style.fontWeight = '600';
    nameEl.textContent = member.name;
    const detailEl = document.createElement('p');
    detailEl.style.margin = '0';
    detailEl.style.fontSize = '0.85rem';
    detailEl.style.color = '#6B7280';
    detailEl.textContent = member.details || '';
    info.appendChild(nameEl);
    info.appendChild(detailEl);
    card.appendChild(info);
    const actions = document.createElement('div');
    actions.className = 'member-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'secondary';
    delBtn.textContent = 'Remover';
    delBtn.addEventListener('click', function () {
      if (!confirm('Deseja remover este membro? As transações permanecerão associadas.')) return;
      members = members.filter((m) => m.id !== member.id);
      saveMembers();
      card.remove();
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);
    return card;
  }

  // Desenha gráfico de pizza simples num canvas a partir de um objeto {categoria: valor}
  function drawPieChart(canvasId, dataObj) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const total = Object.values(dataObj).reduce((a, b) => a + b, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    let startAngle = -Math.PI / 2; // começa em cima
    const colors = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#FCD34D'];
    const keys = Object.keys(dataObj);
    keys.forEach((key, idx) => {
      const value = dataObj[key];
      const sliceAngle = total > 0 ? (value / total) * Math.PI * 2 : 0;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    });
    // Legenda
    const legendX = 10;
    let legendY = 20;
    ctx.font = '14px Inter';
    keys.forEach((key, idx) => {
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(legendX, legendY - 12, 12, 12);
      ctx.fillStyle = '#374151';
      ctx.fillText(`${key} (${formatCurrency(dataObj[key])})`, legendX + 18, legendY);
      legendY += 18;
    });
  }

  // ================================================================
  //  Telas de autenticação (login e registro)
  // ================================================================
  function renderLogin() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) navMenu.style.display = 'none';
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    container.style.maxWidth = '420px';
    container.style.margin = '2rem auto';
    const title = document.createElement('h2');
    title.textContent = 'Entrar';
    container.appendChild(title);
    const form = document.createElement('form');
    form.className = 'flex-col';
    // email
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'E-mail';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.required = true;
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);
    form.appendChild(emailGroup);
    // senha
    const passGroup = document.createElement('div');
    passGroup.className = 'form-group';
    const passLabel = document.createElement('label');
    passLabel.textContent = 'Senha';
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.required = true;
    passGroup.appendChild(passLabel);
    passGroup.appendChild(passInput);
    form.appendChild(passGroup);
    // erro
    const errEl = document.createElement('p');
    errEl.style.color = '#EF4444';
    errEl.style.fontSize = '0.9rem';
    errEl.style.marginBottom = '0.5rem';
    form.appendChild(errEl);
    // submit
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Entrar';
    form.appendChild(submitBtn);
    // link registro
    const regLink = document.createElement('p');
    regLink.style.fontSize = '0.85rem';
    regLink.style.marginTop = '1rem';
    regLink.innerHTML = 'Não tem conta? <a href="#">Cadastrar-se</a>';
    form.appendChild(regLink);
    container.appendChild(form);
    appEl.appendChild(container);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = passInput.value;
      if (!email || !password) {
        errEl.textContent = 'Preencha todos os campos.';
        return;
      }
      const user = users.find((u) => u.email.toLowerCase() === email);
      if (!user) {
        errEl.textContent = 'Usuário não encontrado.';
        return;
      }
      if (user.password !== password) {
        errEl.textContent = 'Senha incorreta.';
        return;
      }
      // sucesso
      saveCurrentUser(user.email);
      // mostra navegação
      if (navMenu) navMenu.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      // carrega dados e vai ao dashboard
      loadData();
      switchPage('dashboard');
    });
    regLink.querySelector('a').addEventListener('click', function (ev) {
      ev.preventDefault();
      renderRegister();
    });
  }

  function renderRegister() {
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) navMenu.style.display = 'none';
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    container.style.maxWidth = '420px';
    container.style.margin = '2rem auto';
    const title = document.createElement('h2');
    title.textContent = 'Cadastrar-se';
    container.appendChild(title);
    const form = document.createElement('form');
    form.className = 'flex-col';
    // email
    const emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'E-mail';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.required = true;
    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(emailInput);
    form.appendChild(emailGroup);
    // senha
    const passGroup = document.createElement('div');
    passGroup.className = 'form-group';
    const passLabel = document.createElement('label');
    passLabel.textContent = 'Senha';
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.required = true;
    passGroup.appendChild(passLabel);
    passGroup.appendChild(passInput);
    form.appendChild(passGroup);
    // confirmar
    const confGroup = document.createElement('div');
    confGroup.className = 'form-group';
    const confLabel = document.createElement('label');
    confLabel.textContent = 'Confirme a senha';
    const confInput = document.createElement('input');
    confInput.type = 'password';
    confInput.required = true;
    confGroup.appendChild(confLabel);
    confGroup.appendChild(confInput);
    form.appendChild(confGroup);
    // aviso
    const warnEl = document.createElement('p');
    warnEl.style.color = '#EF4444';
    warnEl.style.fontSize = '0.9rem';
    warnEl.style.marginBottom = '0.5rem';
    form.appendChild(warnEl);
    // botão
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Cadastrar';
    form.appendChild(submitBtn);
    // link login
    const loginLink = document.createElement('p');
    loginLink.style.fontSize = '0.85rem';
    loginLink.style.marginTop = '1rem';
    loginLink.innerHTML = 'Já possui conta? <a href="#">Entrar</a>';
    form.appendChild(loginLink);
    container.appendChild(form);
    appEl.appendChild(container);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const password = passInput.value;
      const confirm = confInput.value;
      if (!email || !password || !confirm) {
        warnEl.textContent = 'Preencha todos os campos.';
        return;
      }
      if (!allowedEmails.includes(email)) {
        warnEl.textContent = 'Este e-mail não está autorizado a se registrar.';
        return;
      }
      if (users.find((u) => u.email.toLowerCase() === email)) {
        warnEl.textContent = 'Usuário já registrado.';
        return;
      }
      if (password !== confirm) {
        warnEl.textContent = 'As senhas não coincidem.';
        return;
      }
      const newUser = { email: email, password: password };
      users.push(newUser);
      saveUsers();
      // inicia dados vazios
      currentUser = email;
      saveCurrentUser(email);
      transactions = [];
      members = [ { id: 'all', name: 'Todos', details: 'Gastos gerais' } ];
      saveTransactions();
      saveMembers();
      if (navMenu) navMenu.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'inline-block';
      loadData();
      switchPage('dashboard');
    });
    loginLink.querySelector('a').addEventListener('click', function (ev) {
      ev.preventDefault();
      renderLogin();
    });
  }

  function logout() {
    saveCurrentUser(null);
    // limpar dados em memória
    transactions = [];
    members = [];
    editTransactionId = null;
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) navMenu.style.display = 'none';
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    renderLogin();
  }

  // Desenha gráfico de barras simples para receitas e despesas
  function drawBarChart(canvasId, labels, incomesArr, expensesArr) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    // Calcular valores máximos
    const allVals = incomesArr.concat(expensesArr);
    const maxVal = allVals.length ? Math.max(...allVals) : 0;
    const chartHeight = height - 40;
    const barWidth = (width - 60) / (labels.length * 2 + labels.length + 1); // cada grupo tem 2 barras + espaço
    let x = 40;
    // Desenhar eixos
    ctx.strokeStyle = '#D1D5DB';
    ctx.beginPath();
    ctx.moveTo(30, 10);
    ctx.lineTo(30, height - 30);
    ctx.lineTo(width - 10, height - 30);
    ctx.stroke();
    ctx.font = '14px Inter';
    labels.forEach((label, idx) => {
      const incomeHeight = maxVal > 0 ? (incomesArr[idx] / maxVal) * chartHeight : 0;
      const expenseHeight = maxVal > 0 ? (expensesArr[idx] / maxVal) * chartHeight : 0;
      // Receita (azul)
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(x, height - 30 - incomeHeight, barWidth, incomeHeight);
      // Despesa (vermelho)
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(x + barWidth, height - 30 - expenseHeight, barWidth, expenseHeight);
      // Label
      ctx.fillStyle = '#374151';
      ctx.save();
      ctx.translate(x + barWidth, height - 10);
      ctx.rotate(-Math.PI / 10);
      ctx.textAlign = 'left';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      x += barWidth * 2 + barWidth; // próximo grupo
    });
    // legenda
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(width - 150, 10, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Entradas', width - 130, 20);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(width - 150, 28, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('Saídas', width - 130, 38);
  }

  // ================================================
  //  Agenda de contas a pagar/receber
  //  Permite adicionar lembretes com descrição, data, valor e tipo
  //  e listar/remover lembretes existentes. Os dados são salvos
  //  no localStorage por usuário.
  // ================================================
  function renderAgenda() {
    // Assegura que lembretes sejam carregados
    loadReminders();
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Agenda de Contas';
    container.appendChild(header);
    // Formulário para adicionar lembrete
    const form = document.createElement('form');
    form.className = 'flex-col';
    // Descrição
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descrição';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.required = true;
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descInput);
    form.appendChild(descGroup);
    // Data
    const dateGroup = document.createElement('div');
    dateGroup.className = 'form-group';
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Data de vencimento';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.required = true;
    // valor padrão: hoje
    dateInput.value = new Date().toISOString().split('T')[0];
    dateGroup.appendChild(dateLabel);
    dateGroup.appendChild(dateInput);
    form.appendChild(dateGroup);
    // Valor
    const valueGroup = document.createElement('div');
    valueGroup.className = 'form-group';
    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Valor (R$)';
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.step = '0.01';
    valueInput.min = '0';
    valueInput.required = true;
    valueGroup.appendChild(valueLabel);
    valueGroup.appendChild(valueInput);
    form.appendChild(valueGroup);
    // Tipo
    const typeGroup = document.createElement('div');
    typeGroup.className = 'form-group';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Tipo';
    const typeSelect = document.createElement('select');
    [
      { value: 'pay', label: 'Pagar' },
      { value: 'receive', label: 'Receber' },
    ].forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      typeSelect.appendChild(option);
    });
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    form.appendChild(typeGroup);
    // Botão salvar
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'primary';
    submitBtn.textContent = 'Adicionar';
    form.appendChild(submitBtn);
    container.appendChild(form);
    // Lista de lembretes
    const listDiv = document.createElement('div');
    listDiv.className = 'form-group';
    // Tabela
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    ['Data', 'Descrição', 'Valor', 'Tipo', ''].forEach((txt) => {
      const th = document.createElement('th');
      th.textContent = txt;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    listDiv.appendChild(table);
    container.appendChild(listDiv);
    appEl.appendChild(container);
    // Função para atualizar a lista
    function refreshList() {
      // Ordena por data crescente
      reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
      // Limpa corpo
      tbody.innerHTML = '';
      reminders.forEach((reminder) => {
        const tr = document.createElement('tr');
        // Data formatada
        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(reminder.date);
        tr.appendChild(tdDate);
        // Descrição
        const tdDesc = document.createElement('td');
        tdDesc.textContent = reminder.description;
        tr.appendChild(tdDesc);
        // Valor
        const tdVal = document.createElement('td');
        tdVal.textContent = formatCurrency(reminder.value);
        tr.appendChild(tdVal);
        // Tipo
        const tdType = document.createElement('td');
        tdType.textContent = reminder.type === 'pay' ? 'Pagar' : 'Receber';
        // Colore tipo
        tdType.style.color = reminder.type === 'pay' ? '#EF4444' : '#10B981';
        tr.appendChild(tdType);
        // Remover
        const tdDel = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'secondary';
        delBtn.textContent = 'Remover';
        delBtn.addEventListener('click', () => {
          if (!confirm('Deseja remover este lembrete?')) return;
          reminders = reminders.filter((r) => r.id !== reminder.id);
          saveReminders();
          refreshList();
        });
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);
        tbody.appendChild(tr);
      });
    }
    // Preenche tabela inicialmente
    refreshList();
    // Submit form handler
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const desc = descInput.value.trim();
      const date = dateInput.value;
      const val = parseFloat(valueInput.value);
      const type = typeSelect.value;
      if (!desc || !date || isNaN(val) || val <= 0) {
        alert('Preencha todos os campos corretamente.');
        return;
      }
      const newReminder = {
        id: String(Date.now()),
        description: desc,
        date: date,
        value: val,
        type: type,
      };
      reminders.push(newReminder);
      saveReminders();
      // Reset form e lista
      form.reset();
      dateInput.value = new Date().toISOString().split('T')[0];
      refreshList();
    });
  }

  // ================================================================
  //  Despesas Fixas rateadas proporcionalmente ao salário
  //
  //  O usuário informa o valor total da despesa e o salário de cada
  //  membro responsável (exceto o membro genérico "Todos"). O app
  //  calcula a contribuição proporcional de cada um em relação à soma
  //  dos salários, de forma que todos paguem a mesma porcentagem do
  //  próprio salário. Por exemplo, em uma despesa de R$1000, se o pai
  //  recebe 3000 e a mãe 500, a soma dos salários é 3500, a porcentagem
  //  de contribuição é 1000 / 3500 ≈ 28,57%. Assim, o pai paga 3000 *
  //  0,2857 ≈ 857,14 e a mãe 500 * 0,2857 ≈ 142,86.
  // ================================================================
  function renderFixedExpenses() {
    // Carrega membros e despesas fixas
    loadData();
    loadFixedExpenses();
    appEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'card';
    const header = document.createElement('h2');
    header.textContent = 'Despesas Fixas';
    container.appendChild(header);
    // Verifica se há membros além de "Todos"
    const familyMembers = members.filter((m) => m.id !== 'all');
    if (familyMembers.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'Adicione membros na seção Perfil para configurar rateios.';
      container.appendChild(msg);
      appEl.appendChild(container);
      return;
    }
    // Formulário para nova despesa fixa
    const form = document.createElement('form');
    form.className = 'flex-col';
    // Nome da despesa
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nome da despesa';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);
    // Valor total
    const totalGroup = document.createElement('div');
    totalGroup.className = 'form-group';
    const totalLabel = document.createElement('label');
    totalLabel.textContent = 'Valor total (R$)';
    const totalInput = document.createElement('input');
    totalInput.type = 'number';
    totalInput.step = '0.01';
    totalInput.min = '0';
    totalInput.required = true;
    totalGroup.appendChild(totalLabel);
    totalGroup.appendChild(totalInput);
    form.appendChild(totalGroup);
    // Campos de salário por membro
    const salariesGroup = document.createElement('div');
    salariesGroup.className = 'form-group';
    const salLabel = document.createElement('label');
    salLabel.textContent = 'Salário de cada membro';
    salariesGroup.appendChild(salLabel);
    // Contenedor para inputs individuais
    const salaryList = document.createElement('div');
    salaryList.className = 'flex-col';
    familyMembers.forEach((mem) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '0.5rem';
      const label = document.createElement('span');
      label.textContent = mem.name;
      label.style.minWidth = '80px';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.01';
      input.min = '0';
      input.placeholder = 'Salário';
      input.dataset.memberId = mem.id;
      row.appendChild(label);
      row.appendChild(input);
      salaryList.appendChild(row);
    });
    salariesGroup.appendChild(salaryList);
    form.appendChild(salariesGroup);
    // Botão adicionar despesa
    const submitBtn2 = document.createElement('button');
    submitBtn2.type = 'submit';
    submitBtn2.className = 'primary';
    submitBtn2.textContent = 'Adicionar Despesa';
    form.appendChild(submitBtn2);
    container.appendChild(form);
    // Lista de despesas existentes
    const listDiv = document.createElement('div');
    listDiv.style.marginTop = '1rem';
    // Tabela para despesas
    const table2 = document.createElement('table');
    const thead2 = document.createElement('thead');
    const trh = document.createElement('tr');
    const headTitles = ['Despesa', 'Valor total', 'Rateio (por membro)', ''];
    headTitles.forEach((txt) => {
      const th = document.createElement('th');
      th.textContent = txt;
      trh.appendChild(th);
    });
    thead2.appendChild(trh);
    table2.appendChild(thead2);
    const tbody2 = document.createElement('tbody');
    table2.appendChild(tbody2);
    listDiv.appendChild(table2);
    container.appendChild(listDiv);
    appEl.appendChild(container);
    // Função para atualizar lista de despesas
    function refreshFixedList() {
      tbody2.innerHTML = '';
      fixedExpenses.forEach((exp) => {
        const tr = document.createElement('tr');
        // Nome
        const tdName = document.createElement('td');
        tdName.textContent = exp.name;
        tr.appendChild(tdName);
        // Valor total
        const tdTotal = document.createElement('td');
        tdTotal.textContent = formatCurrency(exp.total);
        tr.appendChild(tdTotal);
        // Rateio
        const tdRateio = document.createElement('td');
        // Lista cada contribuição na mesma célula
        const list = document.createElement('ul');
        list.style.paddingLeft = '1rem';
        list.style.margin = '0';
        exp.contributions.forEach((c) => {
          const li = document.createElement('li');
          const mem = getMemberById(c.memberId);
          li.textContent = `${mem ? mem.name : ''}: ${formatCurrency(c.amount)} (${((c.amount / c.salary) * 100).toFixed(2)}% do salário)`;
          list.appendChild(li);
        });
        tdRateio.appendChild(list);
        tr.appendChild(tdRateio);
        // Ação remover
        const tdAct = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'secondary';
        delBtn.textContent = 'Remover';
        delBtn.addEventListener('click', () => {
          if (!confirm('Deseja remover esta despesa fixa?')) return;
          fixedExpenses = fixedExpenses.filter((f) => f.id !== exp.id);
          saveFixedExpenses();
          refreshFixedList();
        });
        tdAct.appendChild(delBtn);
        tr.appendChild(tdAct);
        tbody2.appendChild(tr);
      });
    }
    // Inicializa lista
    refreshFixedList();
    // Submit handler
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const name = nameInput.value.trim();
      const totalVal = parseFloat(totalInput.value);
      if (!name || isNaN(totalVal) || totalVal <= 0) {
        alert('Informe nome e valor válido para a despesa.');
        return;
      }
      // Recupera salários
      const contributions = [];
      let sumSalaries = 0;
      let invalid = false;
      salaryList.querySelectorAll('input').forEach((input) => {
        const salary = parseFloat(input.value);
        const memberId = input.dataset.memberId;
        if (isNaN(salary) || salary <= 0) {
          invalid = true;
        } else {
          sumSalaries += salary;
          contributions.push({ memberId: memberId, salary: salary, amount: 0 });
        }
      });
      if (invalid || sumSalaries <= 0) {
        alert('Informe o salário de todos os membros corretamente.');
        return;
      }
      // Calcula porcentagem da despesa em relação à soma dos salários
      const percent = totalVal / sumSalaries;
      // Atribui contribuição para cada membro
      contributions.forEach((c) => {
        c.amount = parseFloat((c.salary * percent).toFixed(2));
      });
      const newExpense = {
        id: String(Date.now()),
        name: name,
        total: totalVal,
        contributions: contributions,
      };
      fixedExpenses.push(newExpense);
      saveFixedExpenses();
      // Limpa form
      form.reset();
      refreshFixedList();
    });
  }

  // Eventos de navegação
  const navDashboard = document.getElementById('nav-dashboard');
  if (navDashboard) navDashboard.addEventListener('click', () => switchPage('dashboard'));
  const navTrans = document.getElementById('nav-transactions');
  if (navTrans) navTrans.addEventListener('click', () => switchPage('transactions'));
  const navAdd = document.getElementById('nav-add');
  if (navAdd) navAdd.addEventListener('click', () => switchPage('add'));
  const navAgenda = document.getElementById('nav-agenda');
  if (navAgenda) navAgenda.addEventListener('click', () => switchPage('agenda'));
  const navFixed = document.getElementById('nav-fixed');
  if (navFixed) navFixed.addEventListener('click', () => switchPage('fixed'));
  const navProfile = document.getElementById('nav-profile');
  if (navProfile) navProfile.addEventListener('click', () => switchPage('profile'));
  const navLogoutBtn = document.getElementById('nav-logout');
  if (navLogoutBtn) navLogoutBtn.addEventListener('click', () => logout());

  // Inicialização com verificação de autenticação
  (function initApp() {
    loadUsers();
    loadAllowedEmails();
    const saved = loadCurrentUser();
    const navMenu = document.querySelector('.nav-menu');
    if (saved && users.find((u) => u.email === saved)) {
      currentUser = saved;
      if (navMenu) navMenu.style.display = 'flex';
      if (navLogoutBtn) navLogoutBtn.style.display = 'inline-block';
      loadData();
      switchPage('dashboard');
    } else {
      renderLogin();
    }
  })();
})();
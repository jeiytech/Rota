/* ==========================================================================
   Staff Rota – Centralised JavaScript
   Consolidated from:
     - templates/user/rota.html      (rota page logic)
     - templates/user/index.html     (dashboard/index page logic)
     - templates/admin/employee-add.html (admin page logic)

   Page detection uses body class:
     body.rota-page   → rota.html
     body.index-page  → index.html
     body.admin-page  → employee-add.html
   ========================================================================== */


/* ==========================================================================
   SHARED UTILITIES  (used across multiple pages)
   ========================================================================== */

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmt12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function toast(msg, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const el = $(`<div class="toast ${type}"><i class="fa ${icons[type]}"></i>${msg}</div>`);
  $('#toast-container').append(el);
  setTimeout(() => {
    el.css('animation', 'toastOut .25s ease forwards');
    setTimeout(() => el.remove(), 250);
  }, 3000);
}


/**
 * Calculate paid hours from start/end time strings (HH:MM).
 * Rules:
 *   - Strip trailing ≤30 min as unpaid break (always).
 *   - If total worked ≥ 8h, deduct an additional 1h break.
 * Returns { workedMins, breakMins, paidMins } or null if times invalid.
 */
function calcHours(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMins <= 0) return null;

  const extraMins = totalMins % 60; // minutes beyond full hours
  let breakMins = 0;

  // Strip trailing ≤30 min as unpaid (applies always)
  if (extraMins > 0 && extraMins <= 30) {
    breakMins += extraMins;
  }

  // Additional 1h deduction for shifts ≥ 8h total
  if (totalMins >= 480) {
    breakMins += 60;
  }

  const paidMins = totalMins - breakMins;
  return { workedMins: totalMins, breakMins, paidMins };
}

/** Format minutes as "XH:YYM" (e.g. 450 → "7H:30M", 420 → "7H") */
function fmtHours(mins) {
  if (mins === 0) return '0H';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}H:${String(m).padStart(2, '0')}M` : `${h}H`;
}



if (document.body.classList.contains('rota-page')) {

  /* ── State ────────────────────────────────────────────────────────────── */
  let calendar;
  let employees = [];
  let dragEmployee = null; // employee object currently being dragged

  /* ── Employees ────────────────────────────────────────────────────────── */
  function loadEmployees() {
    $.get('/api/employees', function(data) {
      employees = data;
      renderSidebar(employees);
      populateEmployeeSelect(employees);
    }).fail(() => toast('Failed to load staff', 'error'));
  }

  function renderSidebar(list) {
    const $list = $('#staff-list').empty();
    if (!list.length) {
      $list.append('<div class="empty-staff"><i class="fa fa-user-slash"></i>No staff found</div>');
      return;
    }
    list.forEach(emp => {
      const card = $(`
        <div class="staff-card" draggable="true">
          <div class="staff-avatar" style="background:${emp.color}">${initials(emp.name)}</div>
          <div class="staff-info">
            <div class="staff-name">${emp.name}</div>
            <div class="staff-role">${emp.role || 'Staff'}</div>
          </div>
          <i class="fa fa-grip-dots-vertical drag-handle"></i>
        </div>
      `);

      card[0].addEventListener('dragstart', e => {
        dragEmployee = emp;
        card.addClass('dragging');
        // Custom ghost label
        const ghost = document.getElementById('drag-ghost');
        ghost.textContent = emp.name;
        ghost.style.opacity = '1';
        ghost.style.left = (e.clientX + 14) + 'px';
        ghost.style.top  = (e.clientY + 14) + 'px';
        e.dataTransfer.effectAllowed = 'copy';
        // Suppress default browser drag image
        const blank = new Image();
        blank.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(blank, 0, 0);
      });

      card[0].addEventListener('dragend', () => {
        card.removeClass('dragging');
        dragEmployee = null;
        document.getElementById('drag-ghost').style.opacity = '0';
        document.querySelectorAll('.fc-daygrid-day').forEach(c => c.classList.remove('drop-target-active'));
      });

      $list.append(card);
    });
  }

  function populateEmployeeSelect(list) {
    const $sel = $('#shift-employee').empty();
    list.forEach(emp => {
      $sel.append(`<option value="${emp.id}">${emp.name} – ${emp.role}</option>`);
    });
  }

  /* ── Staff Search ─────────────────────────────────────────────────────── */
  $('#staff-search').on('input', function() {
    const q = $(this).val().toLowerCase();
    renderSidebar(employees.filter(e =>
      e.name.toLowerCase().includes(q) || (e.role || '').toLowerCase().includes(q)
    ));
  });

  /* ── Ghost follows cursor ─────────────────────────────────────────────── */
  document.addEventListener('dragover', e => {
    const ghost = document.getElementById('drag-ghost');
    if (ghost.style.opacity === '1') {
      ghost.style.left = (e.clientX + 14) + 'px';
      ghost.style.top  = (e.clientY + 14) + 'px';
    }
  });

  /* ── FullCalendar setup ───────────────────────────────────────────────── */
  function buildCalendar() {
    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left:   'prev,next today',
        center: 'title',
        right:  'dayGridMonth,timeGridWeek,listWeek'
      },
      height: '100%',
      editable: false,
      selectable: false,
      eventDisplay: 'block',
      dayMaxEvents: 5,

      // Render custom event content so name always shows
      eventContent: function(arg) {
        const s = arg.event.extendedProps;
        const time = fmt12(s.start_time) + (s.end_time ? ' – ' + fmt12(s.end_time) : '');
        return {
          html: `<div style="padding:2px 5px;overflow:hidden;">
                   <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${arg.event.title}</div>
                   <div style="font-size:10px;opacity:.8;">${time}</div>
                 </div>`
        };
      },

      // Fetch shifts from API
      events: function(info, successCb, failCb) {
        $.get('/api/shifts', {
          start: info.startStr.slice(0, 10),
          end:   info.endStr.slice(0, 10)
        }, function(data) {
          successCb(data.map(s => ({
            id:              s.id,
            title:           s.employee_name,
            start:           s.date + 'T' + s.start_time,
            end:             s.date + 'T' + s.end_time,
            backgroundColor: s.employee_color,
            borderColor:     s.employee_color,
            textColor:       '#ffffff',
            extendedProps:   s
          })));
          $('#stat-total').text(data.length);
        }).fail(failCb);
      },

      // Click event → edit
      eventClick: function(info) {
        openEditModal(info.event.extendedProps);
      },

      // Wire up drag-and-drop onto each day cell after it mounts
      dayCellDidMount: function(info) {
        const cell = info.el;

        cell.addEventListener('dragover', e => {
          if (!dragEmployee) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          document.querySelectorAll('.fc-daygrid-day').forEach(c => c.classList.remove('drop-target-active'));
          cell.classList.add('drop-target-active');
        });

        cell.addEventListener('dragleave', e => {
          if (!cell.contains(e.relatedTarget)) {
            cell.classList.remove('drop-target-active');
          }
        });

        cell.addEventListener('drop', e => {
          e.preventDefault();
          e.stopPropagation();
          cell.classList.remove('drop-target-active');
          if (!dragEmployee) return;
          const emp = dragEmployee;
          dragEmployee = null;
          document.getElementById('drag-ghost').style.opacity = '0';
          // Read date from the cell's data-date attribute at drop time —
          // always accurate regardless of which child element the pointer
          // was over when the drop fired.
          const droppedDate = cell.getAttribute('data-date');
          openCreateModal(droppedDate, emp);
        });
      },

      datesSet: function() {
        $('#stat-month').text(calendar.view.title);
      }
    });

    calendar.render();
  }

  /* ── Modal helpers ────────────────────────────────────────────────────── */
  function openModal() {
    $('#shift-modal').addClass('open');
    setTimeout(() => $('#shift-start').focus(), 150);
  }
  function closeModal() { $('#shift-modal').removeClass('open'); }

  /**
   * Open modal for a DRAG-DROP create.
   * Date is already known → show banner, hide date input field.
   * Falls back to manual date entry if dateStr is missing/invalid.
   */
  function openCreateModal(dateStr, emp) {
    $('#shift-id').val('');
    $('#modal-title-text').text('Schedule Shift');
    $('#btn-delete-shift').hide();

    $('#shift-employee').val(emp.id);
    $('#shift-start').val('09:00');
    $('#shift-end').val('17:00');
    $('#shift-notes').val('');
    updateHoursSummary();

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Valid date from drag-drop: show banner, hide the redundant date input
      $('#shift-date').val(dateStr);
      $('#modal-date-display').show();
      $('#modal-date-label').text(fmtDate(dateStr));
      $('#date-field-group').hide();
    } else {
      // No valid date: hide banner, show date input so user can pick one
      $('#shift-date').val(new Date().toISOString().slice(0, 10));
      $('#modal-date-display').hide();
      $('#date-field-group').show();
    }

    openModal();
  }

  /**
   * Open modal for EDITING an existing shift.
   * Show both banner (summary) and date input so user can change the date.
   */
  function openEditModal(s) {
    $('#shift-id').val(s.id);
    $('#modal-title-text').text('Edit Shift');
    $('#btn-delete-shift').show();

    $('#shift-date').val(s.date);
    $('#shift-employee').val(s.employee_id);
    $('#shift-start').val(s.start_time);
    $('#shift-end').val(s.end_time);
    $('#shift-notes').val(s.notes || '');
    updateHoursSummary();

    $('#modal-date-display').show();
    $('#modal-date-label').text(fmtDate(s.date));
    $('#date-field-group').show();

    openModal();
  }

  /**
   * Open modal via the "+ Add Shift" button — no date pre-selected.
   * Always hides the drag-drop banner and shows the date input.
   */
  $('#btn-add-shift').on('click', function() {
    $('#shift-id').val('');
    $('#modal-title-text').text('Schedule Shift');
    $('#btn-delete-shift').hide();
    $('#shift-date').val(new Date().toISOString().slice(0, 10));
    if (employees.length) $('#shift-employee').val(employees[0].id);
    $('#shift-start').val('09:00');
    $('#shift-end').val('17:00');
    $('#shift-notes').val('');
    updateHoursSummary();
    // Always hide the drag-drop banner and show the date input for manual entry
    $('#modal-date-display').hide();
    $('#date-field-group').show();
    openModal();
  });

  $('#modal-close, #btn-modal-cancel').on('click', closeModal);
  $('#shift-modal').on('click', function(e) { if ($(e.target).is('#shift-modal')) closeModal(); });
  $(document).on('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ── Save shift ───────────────────────────────────────────────────────── */
  $('#btn-save-shift').on('click', function() {
    const id        = $('#shift-id').val();
    const empId     = $('#shift-employee').val();
    const date      = $('#shift-date').val();
    const startTime = $('#shift-start').val();
    const endTime   = $('#shift-end').val();
    const notes     = $('#shift-notes').val();

    const missingFields = [];
    if (!empId) missingFields.push('Employee');
    if (!date) missingFields.push('Date');
    if (!startTime) missingFields.push('Start Time');
    if (!endTime) missingFields.push('End Time');

    if (missingFields.length > 0) {
      toast(`Please fill in: ${missingFields.join(', ')}`, 'error');
      return;
    }

    if (startTime >= endTime) {
      toast('End time must be after Start Time', 'error');
      return;
    }

    const $btn = $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving…');
    const isEdit = !!id;

    $.ajax({
      url:         isEdit ? `/api/shifts/${id}` : '/api/shifts',
      method:      isEdit ? 'PUT' : 'POST',
      contentType: 'application/json',
      data:        JSON.stringify({ employee_id: parseInt(empId), date, start_time: startTime, end_time: endTime, notes }),
      success: function() {
        closeModal();
        calendar.refetchEvents();
        toast(isEdit ? 'Shift updated' : 'Shift created', 'success');
      },
      error: function(xhr) { toast(xhr.responseJSON?.error || 'Failed to save shift', 'error'); },
      complete: function() { $btn.prop('disabled', false).html('<i class="fa fa-check"></i> Save Shift'); }
    });
  });

  /* ── Delete shift ─────────────────────────────────────────────────────── */
  $('#btn-delete-shift').on('click', function() {
    const id = $('#shift-id').val();
    if (!id || !confirm('Delete this shift? The employee will be notified.')) return;

    const $btn = $(this).prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
    $.ajax({
      url: `/api/shifts/${id}`, method: 'DELETE',
      success: function() { closeModal(); calendar.refetchEvents(); toast('Shift deleted', 'success'); },
      error: function() { toast('Failed to delete shift', 'error'); },
      complete: function() { $btn.prop('disabled', false).html('<i class="fa fa-trash"></i> Delete'); }
    });
  });

  /* ── Hours Summary (modal) ────────────────────────────────────────────── */
  function updateHoursSummary() {
    const start = $('#shift-start').val();
    const end   = $('#shift-end').val();
    const calc  = calcHours(start, end);
    if (!calc) {
      $('#hours-summary').hide();
      return;
    }
    $('#hours-worked').text(fmtHours(calc.workedMins));
    $('#hours-break').text(calc.breakMins > 0 ? fmtHours(calc.breakMins) : 'None');
    $('#hours-paid').text(fmtHours(calc.paidMins));
    $('#hours-summary').show();
  }

  // Recalculate whenever start or end time changes
  $(document).on('change input', '#shift-start, #shift-end', updateHoursSummary);

  /* ── Excel Export ─────────────────────────────────────────────────────── */
  $('#btn-export-excel').on('click', function() {
    // Pre-fill with the calendar's current view dates
    const view = calendar ? calendar.view : null;
    if (view) {
      // activeStart is the first day shown; activeEnd is exclusive so subtract 1 day
      const start = view.activeStart.toISOString().slice(0, 10);
      const end   = new Date(view.activeEnd - 86400000).toISOString().slice(0, 10);
      $('#export-start').val(start);
      $('#export-end').val(end);
    }
    $('#export-modal').addClass('open');
  });

  $('#export-modal-close, #export-modal-cancel').on('click', () => $('#export-modal').removeClass('open'));
  $('#export-modal').on('click', function(e) { if ($(e.target).is('#export-modal')) $(this).removeClass('open'); });

  $('#export-modal-confirm').on('click', function() {
    const start = $('#export-start').val();
    const end   = $('#export-end').val();
    if (!start || !end) { toast('Please set both dates', 'error'); return; }
    if (start > end)    { toast('Start must be before end', 'error'); return; }
    window.location.href = `/api/shifts/export?start=${start}&end=${end}`;
    $('#export-modal').removeClass('open');
  });

  /* ── Refresh staff ────────────────────────────────────────────────────── */
  $('#btn-refresh-staff').on('click', loadEmployees);

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  $(document).ready(function() {
    buildCalendar();
    loadEmployees();
  });

} // end rota-page


/* ==========================================================================
   INDEX / DASHBOARD PAGE  (templates/user/index.html)
   ========================================================================== */

if (document.body.classList.contains('index-page')) {

  const now = new Date();
  const hr  = now.getHours();
  $('#greeting-time').text(hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening');

  const todayStr = now.toISOString().slice(0, 10);

  // Week range
  const wStart = new Date(now); wStart.setDate(now.getDate() - now.getDay());
  const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
  const mStart = todayStr.slice(0, 8) + '01';
  const mEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  $.get('/api/employees', d => $('#stat-employees').text(d.length));

  $.get('/api/shifts', { start: todayStr, end: todayStr }, d => {
    $('#stat-today').text(d.length);
    const $list = $('#today-list').empty();
    if (!d.length) {
      $list.append('<div class="empty-msg">No shifts scheduled for today.</div>');
      return;
    }
    d.forEach(s => {
      $list.append(`
        <div class="shift-row">
          <div class="shift-avatar" style="background:${s.employee_color}">${initials(s.employee_name)}</div>
          <div class="shift-info">
            <div class="shift-name">${s.employee_name}</div>
            <div class="shift-time">${fmt12(s.start_time)} – ${fmt12(s.end_time)}${s.notes ? ' · ' + s.notes : ''}</div>
          </div>
          <span style="font-size:11px;color:var(--muted);">${s.employee_role || ''}</span>
        </div>
      `);
    });
  });

  $.get('/api/shifts', { start: wStart.toISOString().slice(0, 10), end: wEnd.toISOString().slice(0, 10) }, d => $('#stat-week').text(d.length));
  $.get('/api/shifts', { start: mStart, end: mEnd }, d => $('#stat-month').text(d.length));

} // end index-page


/* ==========================================================================
   ADMIN PAGE  (templates/admin/employee-add.html)
   ========================================================================== */

if (document.body.classList.contains('admin-page')) {

  function loadStaff() {
    $.get('/api/employees', function(data) {
      $('#staff-count').text(data.length);
      const $tbody = $('#staff-tbody').empty();
      if (!data.length) {
        $tbody.append('<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">No staff yet. Add your first staff member above.</td></tr>');
        return;
      }
      data.forEach(emp => {
        $tbody.append(`
          <tr>
            <td>
              <div class="name-cell">
                <div class="avatar" style="background:${emp.color}">${initials(emp.name)}</div>
                <strong>${emp.name}</strong>
              </div>
            </td>
            <td style="color:var(--muted)">${emp.email || '–'}</td>
            <td>
              <span class="badge" style="background:${emp.color}22;color:${emp.color};">${emp.role || 'Staff'}</span>
            </td>
            <td style="color:var(--muted)">£${parseFloat(emp.hourly_pay || 0).toFixed(2)}</td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-ghost btn-sm btn-edit" data-id="${emp.id}" data-name="${emp.name}" data-email="${emp.email || ''}" data-role="${emp.role || ''}" data-color="${emp.color}" data-hourly-pay="${emp.hourly_pay || 0}">
                  <i class="fa fa-pencil"></i>
                </button>
                <button class="btn btn-danger btn-sm btn-delete" data-id="${emp.id}" data-name="${emp.name}">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `);
      });
    }).fail(() => toast('Failed to load staff', 'error'));
  }

  // Add
  $('#btn-add-staff').on('click', function() {
    const name = $('#new-name').val().trim();
    if (!name) { toast('Name is required', 'error'); return; }
    const payload = {
      name,
      email: $('#new-email').val().trim(),
      role:  $('#new-role').val().trim(),
      color: $('#new-color').val(),
      hourly_pay: parseFloat($('#new-hourly-pay').val()) || 0
    };
    $.ajax({
      url: '/api/employees', method: 'POST',
      contentType: 'application/json', data: JSON.stringify(payload),
      success: function() {
        toast('Staff member added', 'success');
        $('#new-name,#new-email,#new-role').val('');
        $('#new-color').val('#6366f1');
        $('#new-hourly-pay').val('');
        loadStaff();
      },
      error: () => toast('Failed to add staff member', 'error')
    });
  });

  // Edit modal open
  $(document).on('click', '.btn-edit', function() {
    const d = $(this).data();
    $('#edit-id').val(d.id);
    $('#edit-name').val(d.name);
    $('#edit-email').val(d.email);
    $('#edit-role').val(d.role);
    $('#edit-color').val(d.color);
    $('#edit-hourly-pay').val(parseFloat(d.hourlyPay || 0).toFixed(2));
    $('#edit-modal').addClass('open');
  });

  $('#edit-modal-close, #edit-cancel').on('click', () => $('#edit-modal').removeClass('open'));
  $('#edit-modal').on('click', function(e) { if ($(e.target).is('#edit-modal')) $(this).removeClass('open'); });

  $('#edit-save').on('click', function() {
    const id = $('#edit-id').val();
    const payload = {
      name:  $('#edit-name').val(),
      email: $('#edit-email').val(),
      role:  $('#edit-role').val(),
      color: $('#edit-color').val(),
      hourly_pay: parseFloat($('#edit-hourly-pay').val()) || 0
    };
    $.ajax({
      url: `/api/employees/${id}`, method: 'PUT',
      contentType: 'application/json', data: JSON.stringify(payload),
      success: function() {
        toast('Staff updated', 'success');
        $('#edit-modal').removeClass('open');
        loadStaff();
      },
      error: () => toast('Failed to update', 'error')
    });
  });

  // Delete
  $(document).on('click', '.btn-delete', function() {
    const id   = $(this).data('id');
    const name = $(this).data('name');
    if (!confirm(`Delete "${name}"? All their shifts will also be removed.`)) return;
    $.ajax({
      url: `/api/employees/${id}`, method: 'DELETE',
      success: function() { toast('Staff member deleted', 'success'); loadStaff(); },
      error: () => toast('Failed to delete', 'error')
    });
  });

  $(document).ready(loadStaff);

} // end admin-page

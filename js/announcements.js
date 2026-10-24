/**
 * HCM Lite — Company Announcements Layer
 * Manages organization notices, broadcasting messages, and UI rendering.
 */

const Announcements = (() => {
  'use strict';

  /**
   * Retrieve all announcements sorted newest first.
   * @returns {Object[]}
   */
  function getAllAnnouncements() {
    const list = Storage.get(Storage.KEYS.ANNOUNCEMENTS, []);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Create a new announcement (Admin only).
   * @param {Object} param0
   * @returns {{success: boolean, error?: string, announcement?: Object}}
   */
  function createAnnouncement({ title, message, authorId, authorName }) {
    if (!title || !title.trim()) {
      return { success: false, error: 'Announcement title is required.' };
    }
    if (!message || !message.trim()) {
      return { success: false, error: 'Announcement message body is required.' };
    }

    const list = Storage.get(Storage.KEYS.ANNOUNCEMENTS, []);
    const newNotice = {
      id: Storage.generateId('ann'),
      title: title.trim(),
      message: message.trim(),
      authorId: authorId || 'admin',
      authorName: authorName || 'HR Management',
      createdAt: new Date().toISOString()
    };

    list.push(newNotice);
    Storage.set(Storage.KEYS.ANNOUNCEMENTS, list);

    return { success: true, announcement: newNotice };
  }

  /**
   * Delete an announcement by ID (Admin only).
   * @param {string} id
   * @returns {{success: boolean, error?: string}}
   */
  function deleteAnnouncement(id) {
    const list = Storage.get(Storage.KEYS.ANNOUNCEMENTS, []);
    const filtered = list.filter(a => a.id !== id);
    Storage.set(Storage.KEYS.ANNOUNCEMENTS, filtered);
    return { success: true };
  }

  /**
   * Render announcements into a designated container element.
   * @param {HTMLElement} container
   * @param {boolean} [isAdmin=false]
   */
  function renderAnnouncementsList(container, isAdmin = false) {
    if (!container) return;

    const list = getAllAnnouncements();
    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-6) 0;">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <h4 class="empty-state-title">No announcements posted</h4>
          <p class="empty-state-desc">Recent notices from HR and management will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => {
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Recent';

      const deleteBtn = isAdmin ? `
        <button type="button" class="btn btn-ghost btn-sm" data-delete-ann="${item.id}" style="color: var(--color-error); padding: 4px;" title="Delete Notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      ` : '';

      return `
        <div style="background-color: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-3);">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2);">
            <div>
              <h4 style="font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-main);">${escapeHTML(item.title)}</h4>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">${escapeHTML(item.authorName)} · ${dateStr}</span>
            </div>
            ${deleteBtn}
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-2); line-height: 1.45;">
            ${escapeHTML(item.message)}
          </p>
        </div>
      `;
    }).join('');

    // Attach delete listeners if admin
    if (isAdmin) {
      container.querySelectorAll('[data-delete-ann]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-ann');
          if (confirm('Are you sure you want to delete this announcement?')) {
            deleteAnnouncement(id);
            renderAnnouncementsList(container, isAdmin);
          }
        });
      });
    }
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    getAllAnnouncements,
    createAnnouncement,
    deleteAnnouncement,
    renderAnnouncementsList
  };
})();

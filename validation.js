/**
 * Contact Form Validation & Security
 * Real-time validation with accessibility support
 */

class ContactFormValidator {
  constructor(formId = 'contactForm') {
    this.form = document.getElementById(formId);
    if (!this.form) return;
    
    this.setupValidation();
    this.attachEventListeners();
  }

  // ============================================
  // VALIDATION RULES
  // ============================================

  validators = {
    name: {
      validate: (value) => {
        const trimmed = value.trim();
        return trimmed.length >= 2 && trimmed.length <= 100;
      },
      error: 'Name must be between 2 and 100 characters'
    },
    
    email: {
      validate: (value) => {
        const pattern = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;
        return pattern.test(value);
      },
      error: 'Please enter a valid email address'
    },
    
    phone: {
      validate: (value) => {
        if (value === '') return true; // Optional field
        const pattern = /^(\+33|0033|0)[0-9\s\-\(\)]{8,}$/;
        return pattern.test(value.replace(/\s/g, ''));
      },
      error: 'Please enter a valid French phone number'
    },
    
    subject: {
      validate: (value) => {
        const trimmed = value.trim();
        return trimmed.length >= 3 && trimmed.length <= 100;
      },
      error: 'Subject must be between 3 and 100 characters'
    },
    
    message: {
      validate: (value) => {
        const trimmed = value.trim();
        // Check length
        if (trimmed.length < 10 || trimmed.length > 5000) {
          return false;
        }
        // Check for spam patterns
        const spamPatterns = [
          /viagra|cialis|casino/i,
          /\b(http|https|ftp):\/\/[^\s]+/i,
        ];
        return !spamPatterns.some(pattern => pattern.test(value));
      },
      error: 'Message must be between 10 and 5000 characters (no URLs or spam)'
    }
  };

  // ============================================
  // SETUP & EVENT LISTENERS
  // ============================================

  setupValidation() {
    // Add ARIA attributes
    Object.keys(this.validators).forEach(fieldName => {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.setAttribute('aria-required', 'true');
        field.setAttribute('aria-describedby', `${fieldName}-error`);
      }
    });
  }

  attachEventListeners() {
    // Real-time validation on blur
    Object.keys(this.validators).forEach(fieldName => {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.addEventListener('blur', () => this.validateField(fieldName));
        field.addEventListener('input', () => this.clearError(fieldName));
      }
    });

    // Form submission
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  // ============================================
  // VALIDATION LOGIC
  // ============================================

  validateField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    const value = field.value;
    const validator = this.validators[fieldName];

    if (!validator.validate(value)) {
      this.showError(fieldName, validator.error);
      field.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      this.clearError(fieldName);
      field.setAttribute('aria-invalid', 'false');
      return true;
    }
  }

  validateAllFields() {
    let isValid = true;
    
    Object.keys(this.validators).forEach(fieldName => {
      if (!this.validateField(fieldName)) {
        isValid = false;
      }
    });

    return isValid;
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  showError(fieldName, message) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.form.querySelector(`#${fieldName}-error`) || 
                         this.createErrorElement(fieldName);

    errorElement.textContent = message;
    errorElement.classList.add('form-error-message');
    field.classList.add('form-input-error');
  }

  clearError(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    const errorElement = this.form.querySelector(`#${fieldName}-error`);

    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('form-error-message');
    }
    field.classList.remove('form-input-error');
  }

  createErrorElement(fieldName) {
    const errorDiv = document.createElement('div');
    errorDiv.id = `${fieldName}-error`;
    errorDiv.className = 'form-error-message';
    errorDiv.setAttribute('role', 'alert');
    
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    field.parentNode.insertBefore(errorDiv, field.nextSibling);
    
    return errorDiv;
  }

  // ============================================
  // FORM SUBMISSION
  // ============================================

  async handleSubmit(e) {
    e.preventDefault();

    // Validate all fields
    if (!this.validateAllFields()) {
      this.showMessage('Please fix the errors above', 'error');
      return;
    }

    // Disable submit button
    const submitBtn = this.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      // Prepare form data
      const formData = new FormData(this.form);

      // Send request
      const response = await fetch(this.form.action || 'contact-form-secure.php', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.showMessage(result.message, 'success');
        this.form.reset();
        
        // Announce to screen readers
        this.announceMessage(result.message);
      } else {
        const errorMsg = result.errors?.join(', ') || result.message || 'An error occurred';
        this.showMessage(errorMsg, 'error');
        this.announceMessage(errorMsg, 'alert');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      this.showMessage('Network error. Please try again.', 'error');
      this.announceMessage('Network error. Please try again.', 'alert');
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ============================================
  // USER FEEDBACK
  // ============================================

  showMessage(message, type = 'info') {
    // Remove existing message
    const existing = this.form.querySelector('.form-message');
    if (existing) existing.remove();

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message form-message-${type}`;
    messageDiv.setAttribute('role', 'status');
    messageDiv.setAttribute('aria-live', 'polite');
    messageDiv.textContent = message;

    // Insert at top of form
    this.form.insertBefore(messageDiv, this.form.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  announceMessage(message, role = 'status') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', role);
    announcement.setAttribute('aria-live', 'assertive');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => announcement.remove(), 1000);
  }
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  new ContactFormValidator('contactForm');
});

// ============================================
// CSS STYLES (Add to your stylesheet)
// ============================================

/*
.form-input-error {
  border-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.05);
}

.form-error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 4px;
  display: block;
}

.form-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.95rem;
}

.form-message-success {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.form-message-error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
*/

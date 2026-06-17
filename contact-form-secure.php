<?php
/**
 * Secure Contact Form Handler - Noveather
 * Production-ready contact form with security & validation
 */

// ============================================
// SECURITY CONFIGURATION
// ============================================

// Enable HTTPS only
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    exit();
}

// Security Headers
header('Content-Security-Policy: default-src \'self\'; script-src \'self\'');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Strict-Transport-Security: max-age=63072000; includeSubDomains; preload');

// Start secure session
session_start([
    'cookie_httponly' => true,
    'cookie_secure' => true,
    'cookie_samesite' => 'Strict',
    'use_strict_mode' => true,
]);

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit($identifier, $limit = 5, $window = 3600) {
    $key = 'rate_limit_' . md5($identifier);
    
    if (!isset($_SESSION[$key])) {
        $_SESSION[$key] = [];
    }
    
    // Clean old entries
    $_SESSION[$key] = array_filter($_SESSION[$key], function($timestamp) use ($window) {
        return $timestamp > (time() - $window);
    });
    
    // Check limit
    if (count($_SESSION[$key]) >= $limit) {
        return false;
    }
    
    // Add new request
    $_SESSION[$key][] = time();
    return true;
}

// ============================================
// CSRF TOKEN GENERATION & VALIDATION
// ============================================

function generateCSRFToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCSRFToken($token) {
    return hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

// ============================================
// INPUT VALIDATION
// ============================================

function sanitizeInput($input) {
    // Remove excess whitespace
    $input = trim($input);
    // Remove null bytes
    $input = str_replace("\0", '', $input);
    // HTML encode
    return htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
}

function validateEmail($email) {
    $email = sanitizeInput($email);
    
    // Basic validation
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    
    // Check for common disposable domains (optional)
    $disallowed = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    $domain = substr($email, strpos($email, '@') + 1);
    
    return !in_array(strtolower($domain), $disallowed);
}

function validatePhone($phone) {
    $phone = sanitizeInput($phone);
    
    // Remove common formatting characters
    $phone = preg_replace('/[^0-9+\-\s\(\)]/', '', $phone);
    
    // Validate French number format (+33, 0033, or 0-prefixed)
    if (!preg_match('/^(\+33|0033|0)[0-9\s\-\(\)]{8,}$/', $phone)) {
        return false;
    }
    
    return true;
}

function validateMessage($message) {
    $message = sanitizeInput($message);
    
    // Check length
    if (strlen($message) < 10 || strlen($message) > 5000) {
        return false;
    }
    
    // Check for spam patterns
    $spam_patterns = [
        '/viagra|cialis|casino/i',
        '/\b(http|https|ftp):\/\/[^\s]+/i', // URLs
        '/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i', // Email addresses
    ];
    
    foreach ($spam_patterns as $pattern) {
        if (preg_match($pattern, $message)) {
            return false;
        }
    }
    
    return true;
}

// ============================================
// EMAIL SENDING
// ============================================

function sendEmail($to, $name, $email, $phone, $subject, $message) {
    // Prepare email headers
    $headers = [
        'From: ' . $email,
        'Reply-To: ' . $email,
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: Noveather Contact Form',
    ];
    
    // Email body
    $body = "Nouveau message de: {$name}\n\n";
    $body .= "Téléphone: {$phone}\n";
    $body .= "Email: {$email}\n\n";
    $body .= "Message:\n";
    $body .= str_repeat("-", 40) . "\n";
    $body .= $message . "\n";
    $body .= str_repeat("-", 40) . "\n\n";
    $body .= "IP: " . $_SERVER['REMOTE_ADDR'] . "\n";
    $body .= "Date: " . date('Y-m-d H:i:s') . "\n";
    
    // Send email
    return mail($to, $subject, $body, implode("\r\n", $headers));
}

// ============================================
// FORM SUBMISSION HANDLING
// ============================================

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // Check CSRF token
    if (!validateCSRFToken($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        die(json_encode(['error' => 'Invalid security token']));
    }
    
    // Rate limiting
    $ip = $_SERVER['REMOTE_ADDR'];
    if (!checkRateLimit($ip)) {
        http_response_code(429);
        die(json_encode(['error' => 'Too many requests. Please try again later.']));
    }
    
    // Get and validate input
    $name = sanitizeInput($_POST['name'] ?? '');
    $email = sanitizeInput($_POST['email'] ?? '');
    $phone = sanitizeInput($_POST['phone'] ?? '');
    $subject = sanitizeInput($_POST['subject'] ?? 'Nouveau message');
    $message = sanitizeInput($_POST['message'] ?? '');
    
    // Validate all fields
    $errors = [];
    
    if (empty($name) || strlen($name) < 2) {
        $errors[] = 'Name must be at least 2 characters';
    }
    
    if (!validateEmail($email)) {
        $errors[] = 'Invalid email address';
    }
    
    if (!empty($phone) && !validatePhone($phone)) {
        $errors[] = 'Invalid phone number';
    }
    
    if (!validateMessage($message)) {
        $errors[] = 'Message must be between 10 and 5000 characters';
    }
    
    // Return errors if any
    if (!empty($errors)) {
        http_response_code(400);
        die(json_encode(['errors' => $errors]));
    }
    
    // Attempt to send email
    $sent = sendEmail(
        'contact@noveather.fr',
        $name,
        $email,
        $phone,
        $subject,
        $message
    );
    
    if ($sent) {
        // Log successful submission
        $log_entry = date('Y-m-d H:i:s') . " | " . $email . " | " . $ip . " | Success\n";
        @file_put_contents('/var/log/noveather_contact.log', $log_entry, FILE_APPEND);
        
        // Return success
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Message sent successfully! We\'ll contact you soon.'
        ]);
    } else {
        // Log failed submission
        $log_entry = date('Y-m-d H:i:s') . " | " . $email . " | " . $ip . " | Failed\n";
        @file_put_contents('/var/log/noveather_contact.log', $log_entry, FILE_APPEND);
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error sending message. Please try again later.'
        ]);
    }
    
    exit();
}

// ============================================
// GENERATE CSRF TOKEN FOR FORM
// ============================================

$csrf_token = generateCSRFToken();

?>
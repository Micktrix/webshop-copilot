<?php
/**
 * Plugin Name: Webshop Co-pilot — Forladte Kurve
 * Description: Eksponerer forladte kurve via REST API til Webshop Co-pilot
 */

add_action('rest_api_init', function () {
    register_rest_route('copilot/v1', '/abandoned-carts', [
        'methods'             => 'GET',
        'callback'            => 'copilot_abandoned_carts',
        'permission_callback' => 'copilot_check_secret',
    ]);
});

function copilot_check_secret() {
    $secret = defined('COPILOT_SECRET') ? COPILOT_SECRET : 'skift-mig';
    return ($_GET['secret'] ?? '') === $secret;
}

function copilot_abandoned_carts() {
    global $wpdb;

    $sessions = $wpdb->get_results(
        "SELECT session_key, session_value, session_expiry
         FROM {$wpdb->prefix}woocommerce_sessions
         WHERE session_expiry > UNIX_TIMESTAMP()"
    );

    $result = [];

    foreach ($sessions as $session) {
        $data = maybe_unserialize($session->session_value);

        // Kurv skal have varer
        if (empty($data['cart'])) continue;
        $cart = maybe_unserialize($data['cart']);
        if (empty($cart)) continue;

        // Hent kundeinfo — logget ind eller gæst der startede checkout
        $email = '';
        $fornavn = '';
        $efternavn = '';

        $user_id = intval($session->session_key);
        if ($user_id > 0) {
            $user = get_userdata($user_id);
            if ($user) {
                $email    = $user->user_email;
                $fornavn  = $user->first_name;
                $efternavn = $user->last_name;
            }
        }

        // Gæst der har udfyldt checkout delvist
        if (empty($email) && !empty($data['customer'])) {
            $c        = maybe_unserialize($data['customer']);
            $email    = $c['email']      ?? '';
            $fornavn  = $c['first_name'] ?? '';
            $efternavn = $c['last_name'] ?? '';
        }

        if (empty($email)) continue;

        // Byg produktliste og beregn total
        $produkter = [];
        $total = 0;
        foreach ($cart as $item) {
            if (empty($item['product_id'])) continue;
            $product = wc_get_product($item['product_id']);
            if (!$product) continue;
            $produkter[] = $product->get_name();
            $pris = floatval($item['line_total'] ?? ($product->get_price() * ($item['quantity'] ?? 1)));
            $total += $pris;
        }

        if (empty($produkter)) continue;

        $result[] = [
            'email'    => $email,
            'navn'     => trim("$fornavn $efternavn") ?: 'Gæst',
            'produkter' => implode(', ', $produkter),
            'beloeb'   => (int) round($total),
            'dato'     => date('Y-m-d'),
        ];
    }

    return $result;
}

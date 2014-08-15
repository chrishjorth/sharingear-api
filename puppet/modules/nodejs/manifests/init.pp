class nodejs {
	Exec { path => [ "/bin/", "/sbin/" , "/usr/bin/", "/usr/sbin/", "/etc/init/" ] }

	file { '/home/ubuntu/node':
		ensure => 'directory',
		notify => File['/home/ubuntu/node/app'],
	}

	#Symlink to the app
	file {  '/home/ubuntu/node/app':
    	ensure  => 'link',
    	target  => '/vagrant/app',
  	}

	#We need to update apt-get before installing dependencies
	exec { 'first-apt-update':
		command => 'apt-get update',
	}

	package { ['git', 'curl', 'build-essential', 'python', 'libssl-dev']:
		ensure => 'installed',
		require => Exec['first-apt-update'],
	}

	exec { 'get-node-repo':
		command => 'add-apt-repository ppa:chris-lea/node.js',
		notify => Exec['update-apt-get'],
	}

	#Then we update a second time to get the new nodejs repo
	exec { 'update-apt-get':
		command => 'apt-get update',
		notify => Package['nodejs'],
	}

	package { 'nodejs':
		ensure => 'installed',
		provider => 'apt',
		notify => Service['nodeserver'],
	}

	exec { 'setup-node-port-forwarding':
		command => 'sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 1339',
	}

	file { 'iptablesload':
        source => '/vagrant/puppet/modules/nodejs/files/iptablesload',
        path => '/etc/network/if-pre-up.d/iptablesload',
        mode => 0744,
    }

    file { 'iptablessave':
        source => '/vagrant/puppet/modules/nodejs/files/iptablessave',
        path => '/etc/network/if-post-down.d/iptablessave',
        mode => 0744,
    }

    file { 'nodeserver.conf':
    	source => '/vagrant/puppet/modules/nodejs/files/nodeserver.conf',
    	path => '/etc/init/nodeserver.conf',
    	owner => 'root',
    	group => 'root',
    }

    service {'nodeserver':
    	ensure => 'running',
    	provider => 'upstart',
    	require => File['nodeserver.conf'],
    }
}
FROM debian:bullseye

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

SHELL ["/bin/bash", "--login", "-c"]

#install basic components
RUN apt-get -y update -qq && apt-get -y install gnupg2 ca-certificates bison flex build-essential sudo tmuxinator vim curl net-tools tree autoconf git

# install sip-lab deps
RUN apt-get -y install build-essential automake autoconf libtool libspeex-dev libopus-dev libsdl2-dev libavdevice-dev libswscale-dev libv4l-dev libopencore-amrnb-dev libopencore-amrwb-dev libvo-amrwbenc-dev libvo-amrwbenc-dev libboost-dev libtiff-dev libpcap-dev libssl-dev uuid-dev flite-dev cmake git wget 

# install sngrep deps
RUN apt-get -y install libpcap-dev libncurses5 libssl-dev libncursesw5-dev libpcre2-dev libz-dev

# install sngrep2
RUN <<EOF
set -o errexit
set -o nounset
set -o pipefail

mkdir -p /usr/local/src/git
cd /usr/local/src/git
git clone https://github.com/MayamaTakeshi/sngrep
cd sngrep/
git checkout mrcp_support
./bootstrap.sh
./configure --enable-unicode --with-pcre
make

ln -s `pwd`/src/sngrep /usr/local/bin/sngrep2

EOF

# install yate
RUN <<EOF
set -o errexit
set -o nounset

mkdir -p /usr/local/src/git
cd /usr/local/src/git
git clone https://github.com/yatevoip/yate
cd yate
git checkout 1647cdc467274b293c040d5b4d8880cea2b18072

./autogen.sh 
./configure
make
make install-noapi
EOF

ARG user_name
ARG git_user_name
ARG git_user_email

ARG USER_UID=1000
ARG USER_GID=$USER_UID

SHELL ["/bin/bash", "--login", "-c"]

# Create the user
RUN groupadd --gid $USER_GID $user_name \
    && useradd --uid $USER_UID --gid $USER_GID -m $user_name

RUN echo $user_name ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$user_name \
    && chmod 0440 /etc/sudoers.d/$user_name

RUN echo "wireshark-common wireshark-common/install-setuid boolean true" | debconf-set-selections
RUN apt-get -y update 
RUN apt install -y tshark telnet

USER $user_name

RUN echo "set-option -g default-shell /bin/bash" >> ~/.tmux.conf

ENV TERM=xterm

RUN git config --global user.email $git_user_email
RUN git config --global user.name $git_user_name

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && echo "nvm installation OK"

RUN . ~/.nvm/nvm.sh && nvm install v21.7.0

RUN . ~/.nvm/nvm.sh && npm install -g yarn

RUN mkdir -p ~/.vim/autoload ~/.vim/bundle && curl -LSso ~/.vim/autoload/pathogen.vim https://tpo.pe/pathogen.vim

RUN <<EOF cat > ~/.vimrc
set tabstop=4       " The width of a TAB is set to 4.
                    " Still it is a \t. It is just that
                    " Vim will interpret it to be having
                    " a width of 4.

set shiftwidth=4    " Indents will have a width of 4

set softtabstop=4   " Sets the number of columns for a TAB

set expandtab       " Expand TABs to spaces

execute pathogen#infect()
syntax on
filetype plugin indent on

set background=dark
colorscheme zenburn
EOF

RUN <<EOF
set -o errexit
set -o nounset
set -o pipefail

# install vim zenburn color theme
mkdir -p ~/.vim/colors/
cd ~/.vim/colors/
wget https://raw.githubusercontent.com/jnurmine/Zenburn/de2fa06a93fe1494638ec7b2fdd565898be25de6/colors/zenburn.vim
EOF

RUN <<EOF cat >> ~/.bashrc
export LANG=C.UTF-8
export PS1='\u@\h:\W\$ '
export TZ=Asia/Tokyo
export TERM=xterm-256color
. ~/.nvm/nvm.sh
EOF

COPY conf.d/* /usr/local/src/git/yate/conf.d/
